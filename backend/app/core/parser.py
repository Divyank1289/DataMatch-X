"""
DataMatchX — Multi-Format File Parser
Supports: CSV, JSON, XML, PSV (pipe-separated), XLSX/XLS
Returns a normalized pandas DataFrame.
"""
import io
import json
import xml.etree.ElementTree as ET
from pathlib import Path
from typing import Optional, Union

import pandas as pd


SUPPORTED_FORMATS = {
    ".csv": "csv",
    ".json": "json",
    ".xml": "xml",
    ".psv": "psv",
    ".xlsx": "xlsx",
    ".xls": "xls",
}


def detect_format(filename: str) -> str:
    """Detect file format from extension."""
    ext = Path(filename).suffix.lower()
    fmt = SUPPORTED_FORMATS.get(ext)
    if fmt is None:
        raise ValueError(
            f"Unsupported file format '{ext}'. "
            f"Supported formats: {', '.join(SUPPORTED_FORMATS.keys())}"
        )
    return fmt


def parse_file(content: bytes, filename: str, sheet_name: Optional[Union[str, int]] = 0) -> pd.DataFrame:
    """
    Parse file content into a pandas DataFrame.

    Args:
        content:    Raw bytes of the uploaded file.
        filename:   Original filename (used to detect format).
        sheet_name: Excel sheet name/index (ignored for non-Excel formats).

    Returns:
        A pandas DataFrame with all columns as strings (NaN → empty string).
    """
    fmt = detect_format(filename)

    try:
        if fmt == "csv":
            df = _parse_csv(content)
        elif fmt == "psv":
            df = _parse_psv(content)
        elif fmt == "json":
            df = _parse_json(content)
        elif fmt == "xml":
            df = _parse_xml(content)
        elif fmt in ("xlsx", "xls"):
            df = _parse_excel(content, sheet_name)
        else:
            raise ValueError(f"Unknown format: {fmt}")
    except Exception as exc:
        raise ValueError(f"Failed to parse '{filename}': {exc}") from exc

    # Normalize: strip whitespace from column names and string cells
    df.columns = [str(c).strip() for c in df.columns]
    df = df.map(lambda v: str(v).strip() if pd.notna(v) else "")
    return df


# ── Format-specific parsers ───────────────────────────────────────────────────

def _parse_csv(content: bytes) -> pd.DataFrame:
    return pd.read_csv(
        io.BytesIO(content),
        dtype=str,
        keep_default_na=False,
        encoding="utf-8-sig",
    )


def _parse_psv(content: bytes) -> pd.DataFrame:
    return pd.read_csv(
        io.BytesIO(content),
        sep="|",
        dtype=str,
        keep_default_na=False,
        encoding="utf-8-sig",
    )


def _parse_json(content: bytes) -> pd.DataFrame:
    data = json.loads(content.decode("utf-8-sig"))
    if isinstance(data, list):
        return pd.DataFrame(data, dtype=str)
    elif isinstance(data, dict):
        # Try common wrapper keys
        for key in ("data", "records", "rows", "items"):
            if key in data and isinstance(data[key], list):
                return pd.DataFrame(data[key], dtype=str)
        # Fallback: treat dict as single row
        return pd.DataFrame([data], dtype=str)
    raise ValueError("JSON must be an array of objects or an object with a list field.")


def _parse_xml(content: bytes) -> pd.DataFrame:
    root = ET.fromstring(content.decode("utf-8-sig"))
    records = []
    # Auto-detect: child elements of root are rows
    children = list(root)
    if not children:
        raise ValueError("XML root has no child elements (expected rows as children of root).")

    for child in children:
        record: dict = {}
        # Attributes as columns
        record.update(child.attrib)
        # Sub-elements as columns
        for elem in child:
            record[elem.tag] = (elem.text or "").strip()
        records.append(record)

    return pd.DataFrame(records, dtype=str)


def _parse_excel(content: bytes, sheet_name: Union[str, int] = 0) -> pd.DataFrame:
    return pd.read_excel(
        io.BytesIO(content),
        sheet_name=sheet_name,
        dtype=str,
        keep_default_na=False,
    )
