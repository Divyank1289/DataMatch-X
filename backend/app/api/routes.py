"""
DataMatchX — API Routes
Endpoints:
  POST /api/compare   — Upload source + target + mapping → comparison report
  POST /api/validate  — Validate a mapping file against uploaded files
  GET  /api/report/{id}/csv  — Download last report as CSV (stored in request state)
  GET  /api/report/{id}/html — Download last report as HTML
"""
import json
from typing import Optional

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from fastapi.responses import HTMLResponse, Response

from app.core.comparator import compare
from app.core.mapper import load_mapping, validate_mapping
from app.core.parser import detect_format, parse_file
from app.core.reporter import build_compare_response, to_csv_bytes, to_html
from app.models.schemas import CompareResponse, ErrorResponse, ValidateResponse

router = APIRouter()

# In-memory report store (keyed by report_id)
_report_store: dict[str, CompareResponse] = {}


# ── /compare ──────────────────────────────────────────────────────────────────

@router.post(
    "/compare",
    response_model=CompareResponse,
    responses={400: {"model": ErrorResponse}, 422: {"model": ErrorResponse}},
    summary="Compare two data files using a mapping definition",
    tags=["Comparison"],
)
async def compare_files(
    source: UploadFile = File(..., description="Source data file (CSV/JSON/XML/PSV/XLSX)"),
    target: UploadFile = File(..., description="Target data file (CSV/JSON/XML/PSV/XLSX)"),
    mapping: UploadFile = File(..., description="Mapping definition JSON file"),
    source_sheet: Optional[str] = Form(None, description="Excel sheet name/index for source (Excel only)"),
    target_sheet: Optional[str] = Form(None, description="Excel sheet name/index for target (Excel only)"),
):
    try:
        src_bytes = await source.read()
        tgt_bytes = await target.read()
        map_bytes = await mapping.read()
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Failed to read uploaded files: {exc}")

    # Parse
    try:
        src_df = parse_file(src_bytes, source.filename, sheet_name=_coerce_sheet(source_sheet))
        tgt_df = parse_file(tgt_bytes, target.filename, sheet_name=_coerce_sheet(target_sheet))
        mapping_def = load_mapping(map_bytes)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    # Validate mapping
    errors, warnings = validate_mapping(mapping_def, src_df, tgt_df)
    if errors:
        raise HTTPException(
            status_code=422,
            detail={"message": "Mapping validation failed", "errors": errors, "warnings": warnings},
        )

    # Compare
    try:
        results, summary = compare(src_df, tgt_df, mapping_def)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Comparison engine error: {exc}")

    # Build response
    src_fmt = detect_format(source.filename)
    tgt_fmt = detect_format(target.filename)
    response = build_compare_response(results, summary, src_fmt, tgt_fmt)

    # Store for download endpoints
    _report_store[response.report_id] = response

    return response


# ── /validate ─────────────────────────────────────────────────────────────────

@router.post(
    "/validate",
    response_model=ValidateResponse,
    summary="Validate a mapping file against source and target files",
    tags=["Validation"],
)
async def validate_mapping_file(
    source: UploadFile = File(...),
    target: UploadFile = File(...),
    mapping: UploadFile = File(...),
):
    try:
        src_bytes = await source.read()
        tgt_bytes = await target.read()
        map_bytes = await mapping.read()
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    try:
        src_df = parse_file(src_bytes, source.filename)
        tgt_df = parse_file(tgt_bytes, target.filename)
        mapping_def = load_mapping(map_bytes)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    errors, warnings = validate_mapping(mapping_def, src_df, tgt_df)

    return ValidateResponse(
        valid=len(errors) == 0,
        errors=errors,
        warnings=warnings,
        column_count=len(mapping_def.columns),
        source_key=mapping_def.source_key,
        target_key=mapping_def.target_key,
    )


# ── /report/{id} download endpoints ──────────────────────────────────────────

@router.get(
    "/report/{report_id}/csv",
    summary="Download comparison report as CSV",
    tags=["Reports"],
)
async def download_csv(report_id: str):
    report = _get_report(report_id)
    csv_bytes = to_csv_bytes(report)
    return Response(
        content=csv_bytes,
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="datamatchx_{report_id}.csv"'},
    )


@router.get(
    "/report/{report_id}/html",
    summary="Download comparison report as HTML",
    tags=["Reports"],
    response_class=HTMLResponse,
)
async def download_html(report_id: str):
    report = _get_report(report_id)
    html = to_html(report)
    return HTMLResponse(
        content=html,
        headers={"Content-Disposition": f'attachment; filename="datamatchx_{report_id}.html"'},
    )


@router.get(
    "/report/{report_id}",
    response_model=CompareResponse,
    summary="Retrieve a stored comparison report by ID",
    tags=["Reports"],
)
async def get_report(report_id: str):
    return _get_report(report_id)


@router.get(
    "/reports",
    summary="List all stored report IDs",
    tags=["Reports"],
)
async def list_reports():
    return {"report_ids": list(_report_store.keys()), "count": len(_report_store)}


# ── Helpers ───────────────────────────────────────────────────────────────────

def _get_report(report_id: str) -> CompareResponse:
    report = _report_store.get(report_id.upper())
    if not report:
        raise HTTPException(status_code=404, detail=f"Report '{report_id}' not found. Run /api/compare first.")
    return report


def _coerce_sheet(sheet: Optional[str]):
    if sheet is None:
        return 0
    try:
        return int(sheet)
    except (ValueError, TypeError):
        return sheet
