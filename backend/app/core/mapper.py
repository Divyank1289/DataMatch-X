"""
DataMatchX — Mapping File Processor
Parses, validates, and resolves the JSON mapping definition against
the source and target DataFrames.
"""
import json
from typing import List, Tuple

import pandas as pd

from app.models.schemas import ColumnMapping, MappingDefinition


def load_mapping(content: bytes) -> MappingDefinition:
    """
    Parse raw JSON bytes into a validated MappingDefinition.

    Raises:
        ValueError: If JSON is malformed or schema validation fails.
    """
    try:
        raw = json.loads(content.decode("utf-8-sig"))
    except json.JSONDecodeError as exc:
        raise ValueError(f"Mapping file is not valid JSON: {exc}") from exc

    try:
        return MappingDefinition(**raw)
    except Exception as exc:
        raise ValueError(f"Mapping schema error: {exc}") from exc


def validate_mapping(
    mapping: MappingDefinition,
    source_df: pd.DataFrame,
    target_df: pd.DataFrame,
) -> Tuple[List[str], List[str]]:
    """
    Validate that the mapping's referenced columns exist in the DataFrames.

    Returns:
        (errors, warnings) — lists of human-readable messages.
    """
    errors: List[str] = []
    warnings: List[str] = []

    src_cols = set(source_df.columns)
    tgt_cols = set(target_df.columns)

    # Validate key columns
    if mapping.source_key not in src_cols:
        errors.append(
            f"source_key '{mapping.source_key}' not found in source file. "
            f"Available: {sorted(src_cols)}"
        )
    if mapping.target_key not in tgt_cols:
        errors.append(
            f"target_key '{mapping.target_key}' not found in target file. "
            f"Available: {sorted(tgt_cols)}"
        )

    # Validate each column mapping
    for col_map in mapping.columns:
        if col_map.rule == "ignore":
            continue  # Ignored columns don't need to exist

        if col_map.source not in src_cols:
            errors.append(
                f"Mapped source column '{col_map.source}' not found in source file."
            )
        if col_map.target not in tgt_cols:
            errors.append(
                f"Mapped target column '{col_map.target}' not found in target file."
            )

        # Rule-specific checks
        if col_map.rule == "numeric_tolerance" and col_map.tolerance is None:
            warnings.append(
                f"Column '{col_map.source}' uses 'numeric_tolerance' but no tolerance "
                f"value provided. Defaulting to 0.0 (exact numeric match)."
            )
        if col_map.rule == "regex" and not col_map.pattern:
            errors.append(
                f"Column '{col_map.source}' uses 'regex' rule but no 'pattern' provided."
            )

    # Warn about unmapped source columns
    mapped_src = {c.source for c in mapping.columns}
    for col in src_cols - mapped_src - {mapping.source_key}:
        warnings.append(f"Source column '{col}' is not included in any mapping.")

    return errors, warnings


def get_active_mappings(mapping: MappingDefinition) -> List[ColumnMapping]:
    """Return only non-ignored column mappings."""
    return [c for c in mapping.columns if c.rule != "ignore"]
