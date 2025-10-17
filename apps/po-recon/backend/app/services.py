from __future__ import annotations

import json
import os
import secrets
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

import httpx

from . import schemas, store


class FileExtractionService:
    """Very small extraction stub for CSV/XLSX/PDF/JPG files."""

    SUPPORTED_MIME = {
        "pdf": "application/pdf",
        "jpg": "image/jpeg",
        "csv": "text/csv",
        "xls": "application/vnd.ms-excel",
        "xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }

    def __init__(self, data_store: store.DataStore):
        self.data_store = data_store

    def _save_file(self, upload: bytes, extension: str) -> Path:
        filename = f"{datetime.utcnow().strftime('%Y%m%d%H%M%S')}_{secrets.token_hex(4)}.{extension}"
        path = self.data_store.upload_dir / filename
        path.write_bytes(upload)
        return path

    def handle_upload(
        self,
        file_bytes: bytes,
        file_type: schemas.FileType,
    ) -> Dict[str, Any]:
        file_path = self._save_file(file_bytes, file_type)
        extracted_data: Optional[dict] = None
        errors: Optional[List[str]] = None

        try:
            if file_type in {"csv"}:
                text = file_bytes.decode("utf-8", errors="ignore")
                rows = [line.split(",") for line in text.splitlines() if line.strip()]
                extracted_data = {"rows": rows[:10]}
            else:
                extracted_data = {"message": f"Extraction placeholder for {file_type}"}
            extract_status: schemas.Literal["success", "failure"] = "success"
        except Exception as exc:  # pragma: no cover - defensive
            extract_status = "failure"
            errors = [str(exc)]

        uploaded_file = self.data_store.register_file(
            file_type=file_type,
            extract_status=extract_status,
            extracted_data=extracted_data,
            errors=errors,
        )

        return {
            "file": uploaded_file,
            "path": file_path,
        }


class LLMService:
    """Wrapper for OpenAI usage with a deterministic fallback."""

    def __init__(self, model: str = "gpt-4o-mini") -> None:
        self.model = model
        self.api_key = os.getenv("OPENAI_API_KEY")

    async def analyze(self, prompt: str) -> Dict[str, Any]:
        if not self.api_key:
            return {
                "summary": "LLM analysis not executed (missing OPENAI_API_KEY).",
                "flagged_issues": ["LLM disabled"],
                "recommendations": ["Set OPENAI_API_KEY to enable analysis."],
            }

        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }
        payload = {
            "model": self.model,
            "messages": [
                {"role": "system", "content": "You are a contract reconciliation assistant."},
                {"role": "user", "content": prompt},
            ],
            "response_format": {"type": "json_object"},
        }
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                "https://api.openai.com/v1/chat/completions",
                headers=headers,
                json=payload,
            )
            response.raise_for_status()
            content = response.json()["choices"][0]["message"]["content"]
            try:
                return json.loads(content)
            except json.JSONDecodeError:
                return {
                    "summary": content,
                    "flagged_issues": [],
                    "recommendations": [],
                }


class ReconciliationService:
    def __init__(self, data_store: store.DataStore, llm_service: LLMService):
        self.data_store = data_store
        self.llm_service = llm_service

    def _rule_check_quantity(self, po: schemas.PurchaseOrder, invoice: schemas.Invoice) -> schemas.RuleCheck:
        po_quantity = sum(item.quantity for item in po.items)
        invoice_quantity = sum(item.quantity for item in invoice.items)
        passed = abs(po_quantity - invoice_quantity) < 1e-6
        description = "Invoice quantity must match PO quantity"
        details = (
            f"PO total quantity={po_quantity}, invoice total quantity={invoice_quantity}"
        )
        return schemas.RuleCheck(
            rule_id=secrets.token_hex(6),
            description=description,
            passed=passed,
            details=details,
        )

    def _rule_check_rate(self, po: schemas.PurchaseOrder, invoice: schemas.Invoice) -> schemas.RuleCheck:
        po_rates = {item.description: item.rate for item in po.items}
        mismatches = []
        for item in invoice.items:
            expected_rate = po_rates.get(item.description)
            if expected_rate is None or abs(expected_rate - item.rate) > 1e-6:
                mismatches.append((item.description, expected_rate, item.rate))
        passed = not mismatches
        detail_lines = [
            f"Item '{desc}' expected {expected}, got {actual}" for desc, expected, actual in mismatches
        ]
        details = "; ".join(detail_lines) if detail_lines else "All rates aligned"
        return schemas.RuleCheck(
            rule_id=secrets.token_hex(6),
            description="Invoice rates must match PO rates",
            passed=passed,
            details=details,
        )

    def _add_discrepancy(
        self,
        po: schemas.PurchaseOrder,
        invoice: schemas.Invoice,
        issue_type: schemas.DiscrepancyIssueType,
        summary: str,
        severity: schemas.DiscrepancySeverity,
        detected_by: schemas.DetectedBy,
    ) -> schemas.Discrepancy:
        discrepancy = schemas.Discrepancy(
            discrepancy_id=secrets.token_hex(10),
            linked_po_id=po.po_id,
            linked_invoice_id=invoice.invoice_id,
            issue_type=issue_type,
            summary=summary,
            severity=severity,
            detected_by=detected_by,
            reviewed=False,
        )
        self.data_store.add_discrepancy(discrepancy)
        return discrepancy

    async def reconcile_po_invoice(
        self,
        po: schemas.PurchaseOrder,
        invoice: schemas.Invoice,
    ) -> List[schemas.Discrepancy]:
        discrepancies: List[schemas.Discrepancy] = []

        quantity_rule = self._rule_check_quantity(po, invoice)
        self.data_store.add_rule_check(quantity_rule)
        if not quantity_rule.passed:
            discrepancies.append(
                self._add_discrepancy(
                    po,
                    invoice,
                    "quantity_mismatch",
                    quantity_rule.details,
                    "critical",
                    "rule",
                )
            )

        rate_rule = self._rule_check_rate(po, invoice)
        self.data_store.add_rule_check(rate_rule)
        if not rate_rule.passed:
            discrepancies.append(
                self._add_discrepancy(
                    po,
                    invoice,
                    "rate_mismatch",
                    rate_rule.details,
                    "warning",
                    "rule",
                )
            )

        prompt_parts = [
            "Purchase Order:\n" + po.json(),
            "Invoice:\n" + invoice.json(),
        ]
        contracts = self.data_store.get_contracts_for_vendor(po.vendor_id)
        if contracts:
            prompt_parts.append(
                "Contracts:\n" + json.dumps([contract.dict() for contract in contracts])
            )
        prompt = "\n\n".join(prompt_parts)
        llm_result = await self.llm_service.analyze(prompt)

        analysis = schemas.LLMAnalysis(
            analysis_id=secrets.token_hex(10),
            linked_po_id=po.po_id,
            linked_invoice_id=invoice.invoice_id,
            summary=llm_result.get("summary", ""),
            flagged_issues=list(llm_result.get("flagged_issues", [])),
            recommendations=list(llm_result.get("recommendations", [])),
            output_format="json",
        )
        self.data_store.add_llm_output(analysis)

        for issue in analysis.flagged_issues:
            discrepancies.append(
                self._add_discrepancy(
                    po,
                    invoice,
                    "rate_mismatch",
                    issue,
                    "info",
                    "LLM",
                )
            )

        return discrepancies
