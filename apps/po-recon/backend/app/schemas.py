from datetime import datetime
from enum import Enum
from typing import List, Optional, Literal, Any

from pydantic import BaseModel, Field


FileType = Literal["pdf", "jpg", "csv", "xls", "xlsx"]
DiscrepancyIssueType = Literal[
    "quantity_mismatch",
    "rate_mismatch",
    "missing_po",
    "missing_invoice",
]
DiscrepancySeverity = Literal["info", "warning", "critical"]
DetectedBy = Literal["rule", "LLM"]
AuthMethod = Literal["google", "email"]
AnalysisOutputFormat = Literal["json", "csv", "text"]


class Contract(BaseModel):
    contract_id: str
    vendor_id: str
    agreement_terms: str
    upload_date: datetime
    file_type: FileType
    file_url: str


class POItem(BaseModel):
    description: str
    quantity: float
    rate: float


class PurchaseOrder(BaseModel):
    po_id: str
    vendor_id: str
    items: List[POItem]
    issue_date: datetime


class InvoiceItem(BaseModel):
    description: str
    quantity: float
    rate: float


class Invoice(BaseModel):
    invoice_id: str
    vendor_id: str
    linked_po_id: str
    items: List[InvoiceItem]
    received_date: datetime
    file_type: FileType
    file_url: str


class UploadedFile(BaseModel):
    file_id: str
    file_type: FileType
    extract_status: Literal["success", "failure"]
    extracted_data: Optional[Any]
    errors: Optional[List[str]]


class User(BaseModel):
    user_id: str
    name: str
    email: str
    role: Literal["admin", "user", "vendor"]
    last_login: datetime


class Discrepancy(BaseModel):
    discrepancy_id: str
    linked_po_id: str
    linked_invoice_id: str
    issue_type: DiscrepancyIssueType
    summary: str
    severity: DiscrepancySeverity
    detected_by: DetectedBy
    reviewed: bool


class RuleCheck(BaseModel):
    rule_id: str
    description: str
    passed: bool
    details: str


class LoggedError(BaseModel):
    error_id: str
    file_id: Optional[str]
    step: str
    message: str
    timestamp: datetime


class LLMAnalysis(BaseModel):
    analysis_id: str
    linked_po_id: Optional[str]
    linked_invoice_id: Optional[str]
    summary: str
    flagged_issues: List[str]
    recommendations: List[str]
    output_format: AnalysisOutputFormat


class AuthResponse(BaseModel):
    user_id: str
    auth_method: AuthMethod
    email: str
    token: str
    expires_in: int


class EntityResponse(BaseModel):
    status: Literal["success", "failure"]
    entity: Optional[Any]
    errors: Optional[List[str]] = None


class ReconciliationResponse(BaseModel):
    status: Literal["success", "partial", "failure"]
    findings: List[Discrepancy]
    errors: Optional[List[str]] = None


class DashboardResponse(BaseModel):
    status: Literal["success", "failure"]
    data: List[Discrepancy]
    errors: Optional[List[str]] = None


class ContractUploadRequest(BaseModel):
    vendor_id: str
    agreement_terms: str


class InvoiceUploadRequest(BaseModel):
    vendor_id: str
    linked_po_id: str


class POCreateRequest(BaseModel):
    vendor_id: str
    items: List[POItem]
    issue_date: datetime
    po_id: Optional[str] = Field(default=None)


class ManualInvoiceCreateRequest(BaseModel):
    invoice_id: str
    vendor_id: str
    linked_po_id: str
    items: List[InvoiceItem]
    received_date: datetime
    file_type: FileType
    file_url: str
