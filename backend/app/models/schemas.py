"""
DataMatchX — Pydantic Schemas
"""
from pydantic import BaseModel, Field
from typing import Any, Dict, List, Literal, Optional


# ── Mapping Schemas ───────────────────────────────────────────────────────────

class ColumnMapping(BaseModel):
    source: str = Field(..., description="Column name in the source file")
    target: str = Field(..., description="Column name in the target file")
    rule: Literal["exact", "case_insensitive", "numeric_tolerance", "regex", "ignore"] = "exact"
    tolerance: Optional[float] = Field(None, description="Numeric tolerance (used when rule='numeric_tolerance')")
    pattern: Optional[str] = Field(None, description="Regex pattern (used when rule='regex')")


class MappingDefinition(BaseModel):
    version: str = "1.0"
    source_key: str = Field(..., description="Join/key column in the source file")
    target_key: str = Field(..., description="Join/key column in the target file")
    columns: List[ColumnMapping]


# ── Report Schemas ────────────────────────────────────────────────────────────

class CellDiff(BaseModel):
    column: str
    source_value: Any
    target_value: Any
    rule: str
    matched: bool
    detail: Optional[str] = None


class RowResult(BaseModel):
    key: Any
    status: Literal["match", "mismatch", "source_only", "target_only"]
    diffs: List[CellDiff] = []


class SummaryStats(BaseModel):
    total_source_rows: int
    total_target_rows: int
    matched_rows: int
    mismatched_rows: int
    source_only_rows: int
    target_only_rows: int
    total_columns_compared: int
    match_rate_pct: float


class CompareResponse(BaseModel):
    report_id: str
    summary: SummaryStats
    results: List[RowResult]
    source_format: str
    target_format: str


class ValidateResponse(BaseModel):
    valid: bool
    errors: List[str] = []
    warnings: List[str] = []
    column_count: int
    source_key: str
    target_key: str


class ErrorResponse(BaseModel):
    error: str
    detail: Optional[str] = None
