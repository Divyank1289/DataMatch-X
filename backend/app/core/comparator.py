"""
DataMatchX — Core Comparison Engine
Performs row-level and cell-level comparison between source and target DataFrames
using a validated MappingDefinition.
"""
import math
import re
from typing import Any, List, Tuple

import pandas as pd

from app.models.schemas import (
    CellDiff,
    ColumnMapping,
    MappingDefinition,
    RowResult,
    SummaryStats,
)
from app.core.mapper import get_active_mappings


# ── Public API ────────────────────────────────────────────────────────────────

def compare(
    source_df: pd.DataFrame,
    target_df: pd.DataFrame,
    mapping: MappingDefinition,
) -> Tuple[List[RowResult], SummaryStats]:
    """
    Compare source and target DataFrames using the mapping definition.

    Returns:
        (results, summary) — row-level results and aggregate statistics.
    """
    active_cols = get_active_mappings(mapping)

    # Index both DataFrames by their key column
    src_indexed = source_df.set_index(mapping.source_key)
    tgt_indexed = target_df.set_index(mapping.target_key)

    src_keys = set(src_indexed.index.astype(str))
    tgt_keys = set(tgt_indexed.index.astype(str))

    results: List[RowResult] = []

    # ── Source-only rows ──────────────────────────────────────────────────────
    for key in sorted(src_keys - tgt_keys):
        results.append(RowResult(key=key, status="source_only", diffs=[]))

    # ── Target-only rows ──────────────────────────────────────────────────────
    for key in sorted(tgt_keys - src_keys):
        results.append(RowResult(key=key, status="target_only", diffs=[]))

    # ── Common rows — compare each mapped column ──────────────────────────────
    matched = 0
    mismatched = 0

    for key in sorted(src_keys & tgt_keys):
        src_row = src_indexed.loc[key]
        tgt_row = tgt_indexed.loc[key]

        # Handle duplicate keys (take first occurrence)
        if isinstance(src_row, pd.DataFrame):
            src_row = src_row.iloc[0]
        if isinstance(tgt_row, pd.DataFrame):
            tgt_row = tgt_row.iloc[0]

        diffs = _compare_row(src_row, tgt_row, active_cols)
        row_matched = all(d.matched for d in diffs)

        if row_matched:
            matched += 1
            results.append(RowResult(key=key, status="match", diffs=diffs))
        else:
            mismatched += 1
            results.append(RowResult(key=key, status="mismatch", diffs=diffs))

    # ── Summary ───────────────────────────────────────────────────────────────
    total_compared = matched + mismatched
    match_rate = round((matched / total_compared * 100) if total_compared > 0 else 0.0, 2)

    summary = SummaryStats(
        total_source_rows=len(src_keys),
        total_target_rows=len(tgt_keys),
        matched_rows=matched,
        mismatched_rows=mismatched,
        source_only_rows=len(src_keys - tgt_keys),
        target_only_rows=len(tgt_keys - src_keys),
        total_columns_compared=len(active_cols),
        match_rate_pct=match_rate,
    )

    return results, summary


# ── Cell-level comparison ─────────────────────────────────────────────────────

def _compare_row(
    src_row: pd.Series,
    tgt_row: pd.Series,
    col_mappings: List[ColumnMapping],
) -> List[CellDiff]:
    diffs: List[CellDiff] = []
    for col_map in col_mappings:
        src_val = str(src_row.get(col_map.source, "")).strip()
        tgt_val = str(tgt_row.get(col_map.target, "")).strip()
        matched, detail = _apply_rule(src_val, tgt_val, col_map)
        diffs.append(
            CellDiff(
                column=col_map.source,
                source_value=src_val,
                target_value=tgt_val,
                rule=col_map.rule,
                matched=matched,
                detail=detail,
            )
        )
    return diffs


def _apply_rule(src: str, tgt: str, col_map: ColumnMapping) -> Tuple[bool, str]:
    """Apply the comparison rule and return (matched, detail_message)."""
    rule = col_map.rule

    if rule == "exact":
        matched = src == tgt
        return matched, None if matched else f"'{src}' ≠ '{tgt}'"

    elif rule == "case_insensitive":
        matched = src.lower() == tgt.lower()
        return matched, None if matched else f"'{src}' ≠ '{tgt}' (case-insensitive)"

    elif rule == "numeric_tolerance":
        try:
            src_num = float(src)
            tgt_num = float(tgt)
            tol = col_map.tolerance if col_map.tolerance is not None else 0.0
            diff = abs(src_num - tgt_num)
            matched = diff <= tol
            return matched, None if matched else f"|{src_num} - {tgt_num}| = {diff:.6f} > tolerance {tol}"
        except (ValueError, TypeError):
            return False, f"Cannot parse as numeric: src='{src}', tgt='{tgt}'"

    elif rule == "regex":
        pattern = col_map.pattern or ""
        try:
            matched_src = bool(re.fullmatch(pattern, src))
            matched_tgt = bool(re.fullmatch(pattern, tgt))
            matched = matched_src and matched_tgt
            detail = None
            if not matched:
                parts = []
                if not matched_src:
                    parts.append(f"source '{src}' does not match pattern")
                if not matched_tgt:
                    parts.append(f"target '{tgt}' does not match pattern")
                detail = "; ".join(parts)
            return matched, detail
        except re.error as exc:
            return False, f"Invalid regex pattern '{pattern}': {exc}"

    elif rule == "ignore":
        return True, "ignored"

    return False, f"Unknown rule '{rule}'"
