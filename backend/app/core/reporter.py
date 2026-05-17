"""
DataMatchX — Report Generator
Produces JSON-serializable reports, downloadable CSV diffs, and HTML reports.
"""
import csv
import io
import uuid
from datetime import datetime, timezone
from typing import List

from app.models.schemas import CompareResponse, RowResult, SummaryStats

# ── HTML Template ─────────────────────────────────────────────────────────────
_HTML_TEMPLATE = """<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>DataMatchX Report — {report_id}</title>
<style>
  :root {{
    --bg: #0f1117; --surface: #1a1d27; --border: #2d3148;
    --green: #22c55e; --red: #ef4444; --yellow: #f59e0b;
    --blue: #3b82f6; --text: #e2e8f0; --muted: #94a3b8;
  }}
  * {{ box-sizing: border-box; margin: 0; padding: 0; }}
  body {{ background: var(--bg); color: var(--text); font-family: 'Segoe UI', system-ui, sans-serif; padding: 2rem; }}
  h1 {{ font-size: 1.8rem; background: linear-gradient(135deg, #6366f1, #8b5cf6); -webkit-background-clip: text; -webkit-text-fill-color: transparent; margin-bottom: 0.5rem; }}
  .meta {{ color: var(--muted); font-size: 0.85rem; margin-bottom: 2rem; }}
  .stats {{ display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 1rem; margin-bottom: 2rem; }}
  .stat-card {{ background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 1.2rem; text-align: center; }}
  .stat-card .value {{ font-size: 2rem; font-weight: 700; }}
  .stat-card .label {{ font-size: 0.8rem; color: var(--muted); margin-top: 0.3rem; }}
  .match {{ color: var(--green); }} .mismatch {{ color: var(--red); }}
  .source-only {{ color: var(--yellow); }} .target-only {{ color: var(--blue); }}
  table {{ width: 100%; border-collapse: collapse; background: var(--surface); border-radius: 12px; overflow: hidden; }}
  th {{ background: #252836; padding: 0.75rem 1rem; text-align: left; font-size: 0.8rem; color: var(--muted); text-transform: uppercase; letter-spacing: 0.05em; }}
  td {{ padding: 0.65rem 1rem; border-top: 1px solid var(--border); font-size: 0.9rem; }}
  tr:hover td {{ background: #1e2130; }}
  .badge {{ display: inline-block; padding: 0.2rem 0.6rem; border-radius: 20px; font-size: 0.75rem; font-weight: 600; }}
  .badge-match {{ background: #16a34a22; color: var(--green); border: 1px solid #16a34a55; }}
  .badge-mismatch {{ background: #dc262622; color: var(--red); border: 1px solid #dc262655; }}
  .badge-source_only {{ background: #d9770622; color: var(--yellow); border: 1px solid #d9770655; }}
  .badge-target_only {{ background: #2563eb22; color: var(--blue); border: 1px solid #2563eb55; }}
  .diff-detail {{ font-size: 0.75rem; color: var(--red); margin-top: 0.2rem; }}
  h2 {{ margin: 2rem 0 1rem; font-size: 1.1rem; color: var(--muted); text-transform: uppercase; letter-spacing: 0.08em; }}
</style>
</head>
<body>
<h1>&#9881; DataMatchX Report</h1>
<p class="meta">Report ID: {report_id} &nbsp;|&nbsp; Generated: {generated_at} &nbsp;|&nbsp; Source: {source_format} &nbsp;|&nbsp; Target: {target_format}</p>

<div class="stats">
  <div class="stat-card"><div class="value match">{matched}</div><div class="label">Matched Rows</div></div>
  <div class="stat-card"><div class="value mismatch">{mismatched}</div><div class="label">Mismatched Rows</div></div>
  <div class="stat-card"><div class="value source-only">{source_only}</div><div class="label">Source Only</div></div>
  <div class="stat-card"><div class="value target-only">{target_only}</div><div class="label">Target Only</div></div>
  <div class="stat-card"><div class="value" style="color:#6366f1">{match_rate}%</div><div class="label">Match Rate</div></div>
  <div class="stat-card"><div class="value" style="color:var(--muted)">{columns}</div><div class="label">Columns Compared</div></div>
</div>

<h2>Row-Level Results</h2>
<table>
  <thead><tr><th>Key</th><th>Status</th><th>Column Diffs</th></tr></thead>
  <tbody>
  {rows_html}
  </tbody>
</table>
</body>
</html>"""


# ── Public API ────────────────────────────────────────────────────────────────

def generate_report_id() -> str:
    return str(uuid.uuid4())[:8].upper()


def build_compare_response(
    results: List[RowResult],
    summary: SummaryStats,
    source_format: str,
    target_format: str,
) -> CompareResponse:
    return CompareResponse(
        report_id=generate_report_id(),
        summary=summary,
        results=results,
        source_format=source_format,
        target_format=target_format,
    )


def to_csv_bytes(response: CompareResponse) -> bytes:
    """Export the comparison result as a flat CSV."""
    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(["key", "status", "column", "source_value", "target_value", "rule", "matched", "detail"])

    for row in response.results:
        if row.diffs:
            for diff in row.diffs:
                writer.writerow([
                    row.key, row.status,
                    diff.column, diff.source_value, diff.target_value,
                    diff.rule, diff.matched, diff.detail or "",
                ])
        else:
            writer.writerow([row.key, row.status, "", "", "", "", "", ""])

    return buf.getvalue().encode("utf-8-sig")


def to_html(response: CompareResponse) -> str:
    """Render a standalone HTML report."""
    rows_html_parts = []
    for row in response.results:
        diffs_html = ""
        if row.diffs:
            for d in row.diffs:
                if not d.matched:
                    diffs_html += (
                        f"<div><strong>{d.column}</strong>: "
                        f"<span style='color:#f59e0b'>{_esc(str(d.source_value))}</span> → "
                        f"<span style='color:#ef4444'>{_esc(str(d.target_value))}</span>"
                    )
                    if d.detail:
                        diffs_html += f"<div class='diff-detail'>{_esc(d.detail)}</div>"
                    diffs_html += "</div>"

        match_html = '<span style="color:#22c55e">✓ All match</span>'
        rows_html_parts.append(
            f"<tr>"
            f"<td>{_esc(str(row.key))}</td>"
            f"<td><span class='badge badge-{row.status}'>{row.status.replace('_',' ').title()}</span></td>"
            f"<td>{diffs_html or match_html}</td>"
            f"</tr>"
        )

    s = response.summary
    return _HTML_TEMPLATE.format(
        report_id=response.report_id,
        generated_at=datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC"),
        source_format=response.source_format.upper(),
        target_format=response.target_format.upper(),
        matched=s.matched_rows,
        mismatched=s.mismatched_rows,
        source_only=s.source_only_rows,
        target_only=s.target_only_rows,
        match_rate=s.match_rate_pct,
        columns=s.total_columns_compared,
        rows_html="\n".join(rows_html_parts),
    )


def _esc(text: str) -> str:
    """Minimal HTML escape."""
    return (
        text.replace("&", "&amp;")
            .replace("<", "&lt;")
            .replace(">", "&gt;")
            .replace('"', "&quot;")
    )
