import importlib
import json
import sys
from datetime import datetime

import pytest
from fastapi.testclient import TestClient


def build_test_client(tmp_path, monkeypatch):
    storage_root = tmp_path / "storage"
    monkeypatch.setenv("PO_RECON_STORAGE_ROOT", str(storage_root))
    monkeypatch.setenv("PO_RECON_PUBLIC_URL_PREFIX", "")
    if "app.main" in sys.modules:
        del sys.modules["app.main"]
    module = importlib.import_module("app.main")
    return TestClient(module.app)


@pytest.fixture()
def client(tmp_path, monkeypatch):
    return build_test_client(tmp_path, monkeypatch)


def test_healthcheck(client):
    response = client.get("/healthz")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_po_invoice_flow(client):
    from app.schemas import InvoiceItem, ManualInvoiceCreateRequest, POItem, POCreateRequest

    # Prepare PO payload
    po_payload = POCreateRequest(
        vendor_id="V-100",
        items=[POItem(description="Widget", quantity=10, rate=5.0)],
        issue_date=datetime.utcnow(),
    )
    response = client.post("/api/pos", json=json.loads(po_payload.json()))
    assert response.status_code == 200
    created_po_id = response.json()["entity"]["po_id"]

    # Add invoice manually
    invoice_payload = ManualInvoiceCreateRequest(
        invoice_id="INV-1",
        vendor_id="V-100",
        linked_po_id=created_po_id,
        items=[InvoiceItem(description="Widget", quantity=10, rate=5.0)],
        received_date=datetime.utcnow(),
        file_type="pdf",
        file_url="uploads/invoice.pdf",
    )
    response = client.post("/api/invoices/manual", json=json.loads(invoice_payload.json()))
    assert response.status_code == 200

    # Reconcile
    invoice_id = response.json()["entity"]["invoice_id"]
    po_id = response.json()["entity"]["linked_po_id"]
    reconcile = client.post(
        "/api/reconcile",
        params={"linked_po_id": po_id, "linked_invoice_id": invoice_id},
    )
    assert reconcile.status_code == 200
    data = reconcile.json()
    assert data["status"] in {"success", "partial"}
    assert "findings" in data
