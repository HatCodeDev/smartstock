import uuid
from pydantic import BaseModel
from typing import Literal


class ScanBatchStartRequest(BaseModel):
    product_id: uuid.UUID


class ScanBatchStartResponse(BaseModel):
    session_id: uuid.UUID
    product_name: str


class ConflictDecision(BaseModel):
    epc: str
    deduct_from_original: bool


class ResolveConflictsRequest(BaseModel):
    session_id: uuid.UUID
    action: Literal["reassign_all", "cancel"]
    decisions: list[ConflictDecision] = []


class TagRegistrationStatus(BaseModel):
    epc: str
    status: Literal["new", "duplicate", "conflict"]
    message: str | None = None
    derived_state: Literal["reassignable", "recyclable", "blocked_transit", "blocked_return", "none"] | None = None
    original_product_name: str | None = None
