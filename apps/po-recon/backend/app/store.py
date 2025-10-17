from __future__ import annotations

import secrets
from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict, List, Optional

from . import schemas


class DataStore:
    """In-memory store used for prototyping and development."""

    def __init__(self, upload_dir: Path) -> None:
        self.upload_dir = upload_dir
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
            file_url=str(file_path.relative_to(self.upload_dir.parent)),
        )
        self.contracts[contract_id] = contract
        return contract

    # ----------------------
    # PO operations
    # ----------------------
    def add_purchase_order(
        self,
        po: schemas.PurchaseOrder,
    ) -> schemas.PurchaseOrder:
        self.purchase_orders[po.po_id] = po
        return po

    # ----------------------
    # Invoice operations
    # ----------------------
    def add_invoice(
        self,
        invoice: schemas.Invoice,
    ) -> schemas.Invoice:
        self.invoices[invoice.invoice_id] = invoice
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
    ) -> schemas.UploadedFile:
        file_id = secrets.token_hex(8)
        uploaded_file = schemas.UploadedFile(
            file_id=file_id,
            file_type=file_type,
            extract_status=extract_status,
            extracted_data=extracted_data,
            errors=errors,
        )
        self.files[file_id] = uploaded_file
        return uploaded_file

    # ----------------------
    # Discrepancy operations
    # ----------------------
    def add_discrepancy(
        self,
        discrepancy: schemas.Discrepancy,
    ) -> None:
        self.discrepancies[discrepancy.discrepancy_id] = discrepancy

    def list_discrepancies(self) -> List[schemas.Discrepancy]:
        return list(self.discrepancies.values())

    # ----------------------
    # Rule tracking
    # ----------------------
    def add_rule_check(self, rule: schemas.RuleCheck) -> None:
        self.rule_checks.append(rule)

    def list_rule_checks(self) -> List[schemas.RuleCheck]:
        return self.rule_checks

    # ----------------------
    # Error tracking
    # ----------------------
    def add_error(self, error: schemas.LoggedError) -> None:
        self.errors.append(error)

    def list_errors(self) -> List[schemas.LoggedError]:
        return self.errors

    # ----------------------
    # LLM outputs
    # ----------------------
    def add_llm_output(self, output: schemas.LLMAnalysis) -> None:
        self.llm_outputs.append(output)

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
