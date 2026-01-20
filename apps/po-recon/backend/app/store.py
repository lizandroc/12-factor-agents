from __future__ import annotations

import json
import secrets
from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict, List, Optional

from . import schemas


class DataStore:
    """Lightweight JSON-backed store tailored for shared hosting."""

    def __init__(
        self,
        upload_dir: Path,
        storage_root: Optional[Path] = None,
        public_url_prefix: str = "/storage",
        state_file: Optional[Path] = None,
    ) -> None:
        self.upload_dir = upload_dir
        self.storage_root = storage_root or upload_dir
        self.public_url_prefix = public_url_prefix or ""
        self.state_file = state_file or self.storage_root / "state.json"
        self.contracts: Dict[str, schemas.Contract] = {}
        self.purchase_orders: Dict[str, schemas.PurchaseOrder] = {}
        self.invoices: Dict[str, schemas.Invoice] = {}
        self.files: Dict[str, schemas.UploadedFile] = {}
        self.discrepancies: Dict[str, schemas.Discrepancy] = {}
        self.rule_checks: List[schemas.RuleCheck] = []
        self.errors: List[schemas.LoggedError] = []
        self.llm_outputs: List[schemas.LLMAnalysis] = []
        self.sessions: Dict[str, Dict[str, str]] = {}
        self.users: Dict[str, schemas.User] = {}
        self._load_state()

    # ----------------------
    # Persistence helpers
    # ----------------------
    def _load_state(self) -> None:
        if not self.state_file.exists():
            return

        data = json.loads(self.state_file.read_text())
        self.contracts = {
            item["contract_id"]: schemas.Contract(**item)
            for item in data.get("contracts", [])
        }
        self.purchase_orders = {
            item["po_id"]: schemas.PurchaseOrder(**item)
            for item in data.get("purchase_orders", [])
        }
        self.invoices = {
            item["invoice_id"]: schemas.Invoice(**item)
            for item in data.get("invoices", [])
        }
        file_items = []
        for item in data.get("files", []):
            if "storage_path" not in item or not item["storage_path"]:
                item["storage_path"] = item.get("path", item.get("file_path", "")) or ""
            file_items.append(item)
        self.files = {
            item["file_id"]: schemas.UploadedFile(**item)
            for item in file_items
        }
        self.discrepancies = {
            item["discrepancy_id"]: schemas.Discrepancy(**item)
            for item in data.get("discrepancies", [])
        }
        self.rule_checks = [schemas.RuleCheck(**item) for item in data.get("rule_checks", [])]
        self.errors = [schemas.LoggedError(**item) for item in data.get("errors", [])]
        self.llm_outputs = [schemas.LLMAnalysis(**item) for item in data.get("llm_outputs", [])]
        self.sessions = data.get("sessions", {})
        self.users = {
            item["user_id"]: schemas.User(**item)
            for item in data.get("users", [])
        }

    def _persist_state(self) -> None:
        payload = {
            "contracts": [contract.dict() for contract in self.contracts.values()],
            "purchase_orders": [po.dict() for po in self.purchase_orders.values()],
            "invoices": [invoice.dict() for invoice in self.invoices.values()],
            "files": [file.dict() for file in self.files.values()],
            "discrepancies": [item.dict() for item in self.discrepancies.values()],
            "rule_checks": [item.dict() for item in self.rule_checks],
            "errors": [item.dict() for item in self.errors],
            "llm_outputs": [item.dict() for item in self.llm_outputs],
            "sessions": self.sessions,
            "users": [item.dict() for item in self.users.values()],
        }
        self.state_file.parent.mkdir(parents=True, exist_ok=True)
        self.state_file.write_text(json.dumps(payload, indent=2, default=str))

    def relative_storage_path(self, file_path: Path) -> str:
        try:
            return str(file_path.relative_to(self.storage_root))
        except ValueError:
            return file_path.name

    def to_public_url(self, file_path: Path) -> str:
        try:
            relative = file_path.relative_to(self.storage_root).as_posix()
        except ValueError:
            relative = file_path.name
        prefix = self.public_url_prefix.strip()
        if not prefix:
            return f"/{relative}"
        if prefix.startswith("http://") or prefix.startswith("https://"):
            return f"{prefix.rstrip('/')}/{relative}"
        clean_prefix = prefix.strip("/")
        return f"/{clean_prefix}/{relative}"

    # ----------------------
    # Authentication helpers
    # ----------------------
    def authenticate(self, email: str, method: schemas.AuthMethod) -> schemas.AuthResponse:
        token = secrets.token_urlsafe(16)
        user_id = secrets.token_hex(8)
        now = datetime.utcnow()
        self.sessions[token] = {
            "user_id": user_id,
            "email": email,
            "method": method,
            "expires": (now + timedelta(hours=1)).isoformat(),
        }
        role: schemas.Literal["admin", "user", "vendor"]
        role = "admin" if email.endswith("@admin") else "user"
        self.users[user_id] = schemas.User(
            user_id=user_id,
            name=email.split("@")[0].title() or "User",
            email=email,
            role=role,
            last_login=now,
        )
        self._persist_state()
        return schemas.AuthResponse(
            user_id=user_id,
            auth_method=method,
            email=email,
            token=token,
            expires_in=3600,
        )

    # ----------------------
    # Contract operations
    # ----------------------
    def add_contract(
        self,
        vendor_id: str,
        agreement_terms: str,
        file_type: schemas.FileType,
        file_path: Path,
    ) -> schemas.Contract:
        contract_id = secrets.token_hex(8)
        contract = schemas.Contract(
            contract_id=contract_id,
            vendor_id=vendor_id,
            agreement_terms=agreement_terms,
            upload_date=datetime.utcnow(),
            file_type=file_type,
            file_url=self.to_public_url(file_path),
        )
        self.contracts[contract_id] = contract
        self._persist_state()
        return contract

    # ----------------------
    # PO operations
    # ----------------------
    def add_purchase_order(
        self,
        po: schemas.PurchaseOrder,
    ) -> schemas.PurchaseOrder:
        self.purchase_orders[po.po_id] = po
        self._persist_state()
        return po

    # ----------------------
    # Invoice operations
    # ----------------------
    def add_invoice(
        self,
        invoice: schemas.Invoice,
    ) -> schemas.Invoice:
        self.invoices[invoice.invoice_id] = invoice
        self._persist_state()
        return invoice

    # ----------------------
    # File operations
    # ----------------------
    def register_file(
        self,
        file_type: schemas.FileType,
        extract_status: schemas.Literal["success", "failure"],
        extracted_data: Optional[dict],
        errors: Optional[List[str]],
        storage_path: str,
    ) -> schemas.UploadedFile:
        file_id = secrets.token_hex(8)
        uploaded_file = schemas.UploadedFile(
            file_id=file_id,
            file_type=file_type,
            extract_status=extract_status,
            extracted_data=extracted_data,
            errors=errors,
            storage_path=storage_path,
        )
        self.files[file_id] = uploaded_file
        self._persist_state()
        return uploaded_file

    # ----------------------
    # Discrepancy operations
    # ----------------------
    def add_discrepancy(
        self,
        discrepancy: schemas.Discrepancy,
    ) -> None:
        self.discrepancies[discrepancy.discrepancy_id] = discrepancy
        self._persist_state()

    def list_discrepancies(self) -> List[schemas.Discrepancy]:
        return list(self.discrepancies.values())

    # ----------------------
    # Rule tracking
    # ----------------------
    def add_rule_check(self, rule: schemas.RuleCheck) -> None:
        self.rule_checks.append(rule)
        self._persist_state()

    def list_rule_checks(self) -> List[schemas.RuleCheck]:
        return self.rule_checks

    # ----------------------
    # Error tracking
    # ----------------------
    def add_error(self, error: schemas.LoggedError) -> None:
        self.errors.append(error)
        self._persist_state()

    def list_errors(self) -> List[schemas.LoggedError]:
        return self.errors

    # ----------------------
    # LLM outputs
    # ----------------------
    def add_llm_output(self, output: schemas.LLMAnalysis) -> None:
        self.llm_outputs.append(output)
        self._persist_state()

    def list_llm_outputs(self) -> List[schemas.LLMAnalysis]:
        return self.llm_outputs

    # ----------------------
    # Utility lookups
    # ----------------------
    def get_po(self, po_id: str) -> Optional[schemas.PurchaseOrder]:
        return self.purchase_orders.get(po_id)

    def get_invoice(self, invoice_id: str) -> Optional[schemas.Invoice]:
        return self.invoices.get(invoice_id)

    def get_contracts_for_vendor(self, vendor_id: str) -> List[schemas.Contract]:
        return [c for c in self.contracts.values() if c.vendor_id == vendor_id]


__all__ = ["DataStore"]
