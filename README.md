# ⚙ DataMatchX

> **Multi-format data comparison & validation tool** — Compare CSV, JSON, XML, PSV, and Excel files using a flexible column mapping definition. Get instant row-level diff reports.

---

## Features

- 📂 **Multi-format support**: CSV, JSON, XML, PSV (pipe-separated), XLSX, XLS
- 🗺 **Flexible mapping**: JSON mapping file defines column mappings + comparison rules per column
- 🔬 **Four comparison rules**: `exact`, `case_insensitive`, `numeric_tolerance`, `regex`
- 📊 **Rich reports**: Summary stats + row-level diffs, downloadable as **CSV** or **HTML**
- 🌐 **REST API**: FastAPI with automatic Swagger UI at `/docs`
- 🎨 **Modern SPA frontend**: Dark glassmorphism UI with drag-drop upload, filtering, search, pagination

---

## Quick Start

### 1. Install backend dependencies

```bash
cd backend
pip install -r requirements.txt
```

### 2. Start the backend server

```bash
cd backend
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Backend runs at: http://127.0.0.1:8000  
Swagger UI: http://127.0.0.1:8000/docs

### 3. Open the frontend

Open `frontend/index.html` directly in your browser (no build step needed).

---

## Mapping File Format

```json
{
  "version": "1.0",
  "source_key": "id",
  "target_key": "record_id",
  "columns": [
    { "source": "first_name", "target": "fname",         "rule": "case_insensitive" },
    { "source": "salary",     "target": "compensation",   "rule": "numeric_tolerance", "tolerance": 100.0 },
    { "source": "email",      "target": "email_address",  "rule": "exact" },
    { "source": "notes",      "target": "remarks",        "rule": "ignore" }
  ]
}
```

### Comparison Rules

| Rule | Description |
|---|---|
| `exact` | String equality (default) |
| `case_insensitive` | Case-insensitive string match |
| `numeric_tolerance` | `\|src - tgt\| <= tolerance` |
| `regex` | Both values must match `pattern` (full match) |
| `ignore` | Column is skipped |

---

## API Reference

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/compare` | Compare source + target + mapping → JSON report |
| `POST` | `/api/validate` | Validate mapping file against files |
| `GET`  | `/api/report/{id}` | Retrieve stored report by ID |
| `GET`  | `/api/report/{id}/csv` | Download report as CSV |
| `GET`  | `/api/report/{id}/html` | Download report as HTML |
| `GET`  | `/api/reports` | List all stored report IDs |
| `GET`  | `/health` | Health check |

---

## Sample Data

In `backend/sample_data/`:
- `source.csv` — 8 employee records
- `target.csv` — same employees with column renames, value differences, and a missing/extra row
- `mapping.json` — maps all columns with mixed rules (case-insensitive names, numeric tolerance for salary, exact for email)

Expected results with sample data:
- **Matched**: ~3 rows
- **Mismatched**: ~3 rows (salary diff > tolerance, case diff)
- **Source only**: E007, E008 (not in target)
- **Target only**: E009 (not in source)

---

## Project Structure

```
DataMatch-X/
├── backend/
│   ├── app/
│   │   ├── main.py           # FastAPI entry point
│   │   ├── config.py         # Settings (pydantic-settings)
│   │   ├── api/routes.py     # API endpoints
│   │   ├── core/
│   │   │   ├── parser.py     # Multi-format file parser
│   │   │   ├── mapper.py     # Mapping loader & validator
│   │   │   ├── comparator.py # Comparison engine
│   │   │   └── reporter.py   # CSV/HTML report generator
│   │   └── models/schemas.py # Pydantic schemas
│   ├── sample_data/
│   │   ├── source.csv
│   │   ├── target.csv
│   │   └── mapping.json
│   └── requirements.txt
├── frontend/
│   ├── index.html
│   ├── css/style.css
│   └── js/app.js
└── README.md
```
