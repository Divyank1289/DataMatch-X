import React, { useState, useEffect } from 'react';
import {
  Upload,
  FileSpreadsheet,
  FileJson,
  Play,
  RotateCcw,
  Download,
  CheckCircle2,
  XCircle,
  HelpCircle,
  FileCode,
  Layers,
  ArrowRightLeft,
  ChevronLeft,
  ChevronRight,
  Search,
  Check,
  X,
  FileText
} from 'lucide-react';
import { CONFIG } from './config';
import UploadZone from './components/UploadZone';
import InteractiveMapper from './components/InteractiveMapper';
import ResultRow from './components/ResultRow';

const PAGE_SIZE = 20;

export default function App() {
  // ── States ──
  const [sourceFile, setSourceFile] = useState(null);
  const [targetFile, setTargetFile] = useState(null);
  const [mappingFile, setMappingFile] = useState(null);

  const [sourceCols, setSourceCols] = useState([]);
  const [targetCols, setTargetCols] = useState([]);

  // Default interactive mapping definition
  const [mapping, setMapping] = useState({
    version: '1.0',
    source_key: '',
    target_key: '',
    columns: [],
  });

  const [sourceSheet, setSourceSheet] = useState('');
  const [targetSheet, setTargetSheet] = useState('');

  // Results
  const [results, setResults] = useState([]);
  const [summary, setSummary] = useState(null);
  const [reportId, setReportId] = useState(null);
  const [sourceFormat, setSourceFormat] = useState('');
  const [targetFormat, setTargetFormat] = useState('');

  // Filtering & Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [activeFilter, setActiveFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortCol, setSortCol] = useState(null);
  const [sortAsc, setSortAsc] = useState(true);

  // Status & UI
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0); // 0=idle, 1=parsing, 2=mapping, 3=comparing, 4=done
  const [error, setError] = useState(null);
  const [toasts, setToasts] = useState([]);

  // Toast Helper
  const triggerToast = (msg, type = 'info') => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, msg, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  };

  // ── File Parsers & Header Fetching ──
  // Fetch source headers on change
  useEffect(() => {
    if (!sourceFile) {
      setSourceCols([]);
      return;
    }
    parseHeaders(sourceFile, sourceSheet, setSourceCols, 'Source');
  }, [sourceFile, sourceSheet]);

  // Fetch target headers on change
  useEffect(() => {
    if (!targetFile) {
      setTargetCols([]);
      return;
    }
    parseHeaders(targetFile, targetSheet, setTargetCols, 'Target');
  }, [targetFile, targetSheet]);

  // Process uploaded mapping file
  useEffect(() => {
    if (!mappingFile) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const json = JSON.parse(e.target.result);
        if (!json.source_key || !json.target_key || !Array.isArray(json.columns)) {
          throw new Error('Missing key fields (source_key, target_key, columns) in JSON mapping.');
        }
        setMapping({
          version: json.version || '1.0',
          source_key: json.source_key,
          target_key: json.target_key,
          columns: json.columns.map((c) => ({
            source: c.source || '',
            target: c.target || '',
            rule: c.rule || 'exact',
            tolerance: c.tolerance !== undefined ? c.tolerance : null,
            pattern: c.pattern || '',
          })),
        });
        triggerToast('✓ Custom mapping file successfully uploaded and loaded!', 'success');
      } catch (err) {
        setError({
          title: 'Invalid Mapping JSON',
          message: `Failed to load uploaded JSON file: ${err.message}. Please double check the schema or create it visually below.`,
        });
        triggerToast('❌ Invalid mapping file schema', 'error');
        setMappingFile(null);
      }
    };
    reader.readAsText(mappingFile);
  }, [mappingFile]);

  const parseHeaders = async (file, sheet, setCols, label) => {
    setError(null);
    const form = new FormData();
    form.append('file', file);
    if (sheet.trim()) {
      form.append('sheet', sheet.trim());
    }

    try {
      const res = await fetch(`${CONFIG.API_BASE}/parse-headers`, {
        method: 'POST',
        body: form,
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.detail || `Failed to parse columns from ${file.name}`);
      }

      setCols(data.columns || []);
      triggerToast(`✓ Loaded ${data.columns.length} columns from ${label} file!`, 'success');
    } catch (err) {
      setError({
        title: `${label} Parsing Error`,
        message: err.message,
      });
      triggerToast(`❌ Failed to parse columns from ${label} file`, 'error');
    }
  };

  // ── Run Comparison ──
  const runComparison = async () => {
    if (!sourceFile || !targetFile) {
      triggerToast('❌ Source and Target files are required!', 'error');
      return;
    }

    if (!mapping.source_key || !mapping.target_key) {
      triggerToast('❌ Primary Join Keys must be set in the Mapping configuration!', 'error');
      return;
    }

    if (!mapping.columns || mapping.columns.length === 0) {
      triggerToast('❌ Please map at least one column pairing!', 'error');
      return;
    }

    setLoading(true);
    setLoadingStep(1);
    setError(null);
    setSummary(null);
    setResults([]);

    const form = new FormData();
    form.append('source', sourceFile);
    form.append('target', targetFile);

    // Create the mapping file as a JSON blob dynamically!
    const mappingBlob = new Blob([JSON.stringify(mapping)], {
      type: 'application/json',
    });
    form.append('mapping', mappingBlob, 'mapping.json');

    if (sourceSheet.trim()) form.append('source_sheet', sourceSheet.trim());
    if (targetSheet.trim()) form.append('target_sheet', targetSheet.trim());

    // Animate loader steps
    const timer1 = setTimeout(() => setLoadingStep(2), 500);
    const timer2 = setTimeout(() => setLoadingStep(3), 1100);

    try {
      const res = await fetch(`${CONFIG.API_BASE}/compare`, {
        method: 'POST',
        body: form,
      });
      const data = await res.json();

      if (!res.ok) {
        const msg = data.detail?.message || data.detail || JSON.stringify(data);
        const errs = data.detail?.errors ? '\n• ' + data.detail.errors.join('\n• ') : '';
        throw new Error(msg + errs);
      }

      setResults(data.results || []);
      setSummary(data.summary);
      setReportId(data.report_id);
      setSourceFormat(data.source_format);
      setTargetFormat(data.target_format);

      // Reset filters & page
      setCurrentPage(1);
      setActiveFilter('all');
      setSearchQuery('');
      setSortCol(null);

      setLoadingStep(4);
      triggerToast(`✓ Comparison complete — Report: ${data.report_id}`, 'success');
    } catch (err) {
      setError({
        title: 'Comparison Failed',
        message: err.message,
      });
      triggerToast('❌ Comparison run failed', 'error');
    } finally {
      clearTimeout(timer1);
      clearTimeout(timer2);
      setLoading(false);
    }
  };

  // ── Run Validation ──
  const runValidation = async () => {
    if (!sourceFile || !targetFile) {
      triggerToast('❌ Upload files first!', 'error');
      return;
    }
    setLoading(true);
    setError(null);

    const form = new FormData();
    form.append('source', sourceFile);
    form.append('target', targetFile);

    const mappingBlob = new Blob([JSON.stringify(mapping)], {
      type: 'application/json',
    });
    form.append('mapping', mappingBlob, 'mapping.json');

    try {
      const res = await fetch(`${CONFIG.API_BASE}/validate`, {
        method: 'POST',
        body: form,
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(JSON.stringify(data.detail));
      }

      if (data.valid) {
        triggerToast(`✓ Mapping configuration is valid! ${data.column_count} columns mapped successfully.`, 'success');
      } else {
        const errMsg = data.errors.map((e) => `• ${e}`).join('\n');
        setError({
          title: 'Mapping Validation Failed',
          message: errMsg,
        });
        triggerToast('❌ Mapping configuration has validation errors', 'error');
      }

      if (data.warnings && data.warnings.length) {
        data.warnings.forEach((w) => triggerToast(`⚠ ${w}`, 'info'));
      }
    } catch (err) {
      setError({
        title: 'Validation Failed',
        message: err.message,
      });
    } finally {
      setLoading(false);
    }
  };

  // ── Download Report ──
  const downloadReport = async (type) => {
    if (!reportId) return;
    try {
      const res = await fetch(`${CONFIG.API_BASE}/report/${reportId}/${type}`);
      if (!res.ok) throw new Error(await res.text());
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `datamatchx_${reportId}.${type}`;
      a.click();
      URL.revokeObjectURL(url);
      triggerToast(`✓ Downloaded ${type.toUpperCase()} report successfully!`, 'success');
    } catch (err) {
      triggerToast(`❌ Download failed: ${err.message}`, 'error');
    }
  };

  // ── Reset ──
  const resetAll = () => {
    setSourceFile(null);
    setTargetFile(null);
    setMappingFile(null);
    setSourceCols([]);
    setTargetCols([]);
    setMapping({
      version: '1.0',
      source_key: '',
      target_key: '',
      columns: [],
    });
    setSourceSheet('');
    setTargetSheet('');
    setResults([]);
    setSummary(null);
    setReportId(null);
    setCurrentPage(1);
    setActiveFilter('all');
    setSearchQuery('');
    setSortCol(null);
    setError(null);
    triggerToast('🔄 Application reset complete', 'info');
  };

  // ── Filtering, Sorting & Pagination Computations ──
  let processedResults = [...results];

  // 1. Filter
  if (activeFilter !== 'all') {
    processedResults = processedResults.filter((r) => r.status === activeFilter);
  }

  // 2. Search
  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    processedResults = processedResults.filter((r) => {
      const keyMatch = String(r.key).toLowerCase().includes(q);
      const diffMatch = r.diffs?.some(
        (d) =>
          String(d.source_value).toLowerCase().includes(q) ||
          String(d.target_value).toLowerCase().includes(q) ||
          d.column.toLowerCase().includes(q)
      );
      return keyMatch || diffMatch;
    });
  }

  // 3. Sort
  if (sortCol) {
    processedResults.sort((a, b) => {
      let va = sortCol === 'key' ? String(a.key) : a.status;
      let vb = sortCol === 'key' ? String(b.key) : b.status;
      const cmp = va.localeCompare(vb);
      return sortAsc ? cmp : -cmp;
    });
  }

  // Count metrics for tabs
  const filterCounts = {
    all: results.length,
    match: results.filter((r) => r.status === 'match').length,
    mismatch: results.filter((r) => r.status === 'mismatch').length,
    source_only: results.filter((r) => r.status === 'source_only').length,
    target_only: results.filter((r) => r.status === 'target_only').length,
  };

  // Pagination slice
  const total = processedResults.length;
  const totalPages = Math.ceil(total / PAGE_SIZE) || 1;
  const activePage = Math.min(currentPage, totalPages);
  const startIdx = (activePage - 1) * PAGE_SIZE;
  const paginatedRows = processedResults.slice(startIdx, startIdx + PAGE_SIZE);

  const handleSort = (col) => {
    if (sortCol === col) {
      setSortAsc(!sortAsc);
    } else {
      setSortCol(col);
      setSortAsc(true);
    }
  };

  // Page range helper
  const getPageRange = () => {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    if (activePage <= 4) {
      return [1, 2, 3, 4, 5, '…', totalPages];
    }
    if (activePage >= totalPages - 3) {
      return [1, '…', totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
    }
    return [1, '…', activePage - 1, activePage, activePage + 1, '…', totalPages];
  };

  return (
    <div className="app-container">
      {/* Toast Notifications */}
      <div className="toast-container" role="alert" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast-${t.type}`}>
            {t.type === 'success' && <CheckCircle2 size={16} />}
            {t.type === 'error' && <XCircle size={16} />}
            {t.type === 'info' && <Layers size={16} />}
            {t.msg}
          </div>
        ))}
      </div>

      {/* Header */}
      <header>
        <div className="logo">
          <div className="logo-icon">⚙</div>
          <span className="logo-text">DataMatchX</span>
          <span className="logo-badge">v1.1</span>
        </div>
        <nav className="header-links">
          <a href={`${CONFIG.API_BASE.replace('/api', '')}/docs`} target="_blank" rel="noopener noreferrer">
            API Docs
          </a>
          <a href={`${CONFIG.API_BASE.replace('/api', '')}/health`} target="_blank" rel="noopener noreferrer">
            Health
          </a>
          <a href="https://github.com/Divyank1289/DataMatch-X" target="_blank" rel="noopener noreferrer">
            GitHub
          </a>
        </nav>
      </header>

      {/* Main Area */}
      <main>
        {/* Hero Section */}
        <section className="hero">
          <h1>Compare Data.<br />Find Differences.<br />Trust Your Data.</h1>
          <p>
            Upload any two data files and compare them using an interactive mapping configuration. Highlight structural, case, and numeric cell drift in real time.
          </p>
          <div className="supported-formats">
            <span className="fmt-chip">CSV</span>
            <span className="fmt-chip">JSON</span>
            <span className="fmt-chip">XML</span>
            <span className="fmt-chip">PSV</span>
            <span className="fmt-chip">XLSX</span>
            <span className="fmt-chip">XLS</span>
          </div>
        </section>

        {/* Step 1 — Upload Panel */}
        <div className="section-title">
          <Layers size={14} /> Step 1 — Upload Datasets & Mapping
        </div>
        
        <div className="upload-panel">
          <UploadZone
            label="Source Dataset"
            hint="CSV, JSON, XML, PSV, XLSX, XLS"
            accept=".csv,.json,.xml,.psv,.xlsx,.xls"
            file={sourceFile}
            setFile={setSourceFile}
            icon={Upload}
          />
          <UploadZone
            label="Target Dataset"
            hint="CSV, JSON, XML, PSV, XLSX, XLS"
            accept=".csv,.json,.xml,.psv,.xlsx,.xls"
            file={targetFile}
            setFile={setTargetFile}
            icon={Upload}
          />
          <UploadZone
            label="Mapping JSON (Optional)"
            hint="Pre-configured JSON mappings"
            accept=".json"
            file={mappingFile}
            setFile={setMappingFile}
            icon={FileJson}
          />
        </div>

        {/* Step 1.5 — Optional Sheets Config */}
        {( (sourceFile && sourceFile.name.match(/\.xlsx?$/i)) || (targetFile && targetFile.name.match(/\.xlsx?$/i)) ) && (
          <div className="options-panel">
            {sourceFile && sourceFile.name.match(/\.xlsx?$/i) && (
              <div className="option-group">
                <label htmlFor="sourceSheet">Source Sheet (Excel only)</label>
                <input
                  type="text"
                  id="sourceSheet"
                  placeholder="0 or Sheet Name"
                  value={sourceSheet}
                  onChange={(e) => setSourceSheet(e.target.value)}
                />
              </div>
            )}
            {targetFile && targetFile.name.match(/\.xlsx?$/i) && (
              <div className="option-group">
                <label htmlFor="targetSheet">Target Sheet (Excel only)</label>
                <input
                  type="text"
                  id="targetSheet"
                  placeholder="0 or Sheet Name"
                  value={targetSheet}
                  onChange={(e) => setTargetSheet(e.target.value)}
                />
              </div>
            )}
          </div>
        )}

        {/* Step 2 — Interactive Mapping Configuration */}
        {(sourceFile || targetFile) && (
          <>
            <div className="section-title">
              <ArrowRightLeft size={14} /> Step 2 — Column Matching Configuration
            </div>
            <InteractiveMapper
              sourceCols={sourceCols}
              targetCols={targetCols}
              mapping={mapping}
              setMapping={setMapping}
              onToast={triggerToast}
            />
          </>
        )}

        {/* Action Panel */}
        <div className="actions">
          <button
            className="btn btn-primary"
            onClick={runComparison}
            disabled={loading || !sourceFile || !targetFile || !mapping.source_key || !mapping.target_key}
          >
            <Play size={16} /> Run Data Comparison
          </button>
          
          <button
            className="btn btn-secondary"
            onClick={runValidation}
            disabled={loading || !sourceFile || !targetFile || !mapping.source_key || !mapping.target_key}
          >
            ✓ Validate Setup
          </button>

          <button className="btn btn-secondary" onClick={resetAll} disabled={loading}>
            <RotateCcw size={16} /> Reset
          </button>
        </div>

        {/* Error Panel */}
        {error && (
          <div className="error-box">
            <h4>
              <XCircle size={16} /> {error.title}
            </h4>
            <p>{error.message}</p>
          </div>
        )}

        {/* Loading Overlay */}
        {loading && (
          <div className="loading-overlay">
            <div className="spinner" />
            <div className="loading-text">Analyzing & Comparing Datasets...</div>
            <div className="loading-steps">
              <span className={`step-chip ${loadingStep === 1 ? 'active' : ''} ${loadingStep > 1 ? 'done' : ''}`}>
                Parsing Files
              </span>
              <span className={`step-chip ${loadingStep === 2 ? 'active' : ''} ${loadingStep > 2 ? 'done' : ''}`}>
                Mapping Columns
              </span>
              <span className={`step-chip ${loadingStep === 3 ? 'active' : ''} ${loadingStep > 3 ? 'done' : ''}`}>
                Evaluating Matching Rules
              </span>
              <span className={`step-chip ${loadingStep === 4 ? 'active' : ''}`}>
                Compiling Report
              </span>
            </div>
          </div>
        )}

        {/* Step 3 — Report Section */}
        {summary && (
          <div className="results-section" style={{ display: 'block' }}>
            <div className="section-title">
              <CheckCircle2 size={14} /> Step 3 — Comparison Report
            </div>

            <div
              className="report-meta"
              style={{
                fontSize: '0.8rem',
                color: 'var(--text-muted)',
                marginBottom: '1.2rem',
                fontFamily: 'JetBrains Mono, monospace',
              }}
            >
              REPORT ID: {reportId} &nbsp;|&nbsp; SOURCE FORMAT: {sourceFormat.toUpperCase()} &nbsp;|&nbsp; TARGET FORMAT: {targetFormat.toUpperCase()} &nbsp;|&nbsp; {summary.total_source_rows} SOURCE ROWS VS {summary.total_target_rows} TARGET ROWS
            </div>

            {/* Stats grid */}
            <div className="stats-grid">
              <div className="stat-card" style={{ '--accent-color': 'var(--green)' }}>
                <div className="stat-icon">✓</div>
                <div className="stat-value" style={{ color: 'var(--green)' }}>
                  {summary.matched_rows}
                </div>
                <div className="stat-label">Matched Rows</div>
              </div>

              <div className="stat-card" style={{ '--accent-color': 'var(--red)' }}>
                <div className="stat-icon">✗</div>
                <div className="stat-value" style={{ color: 'var(--red)' }}>
                  {summary.mismatched_rows}
                </div>
                <div className="stat-label">Mismatched Rows</div>
              </div>

              <div className="stat-card" style={{ '--accent-color': 'var(--yellow)' }}>
                <div className="stat-icon">◈</div>
                <div className="stat-value" style={{ color: 'var(--yellow)' }}>
                  {summary.source_only_rows}
                </div>
                <div className="stat-label">Source Only</div>
              </div>

              <div className="stat-card" style={{ '--accent-color': 'var(--blue)' }}>
                <div className="stat-icon">◆</div>
                <div className="stat-value" style={{ color: 'var(--blue)' }}>
                  {summary.target_only_rows}
                </div>
                <div className="stat-label">Target Only</div>
              </div>

              <div className="stat-card" style={{ '--accent-color': 'var(--accent)' }}>
                <div className="stat-icon">⬡</div>
                <div className="stat-value" style={{ color: 'var(--accent)' }}>
                  {summary.match_rate_pct}%
                </div>
                <div className="stat-label">Match Rate</div>
              </div>

              <div className="stat-card" style={{ '--accent-color': 'var(--accent-3)' }}>
                <div className="stat-icon">⊞</div>
                <div className="stat-value" style={{ color: 'var(--accent-3)' }}>
                  {summary.total_columns_compared}
                </div>
                <div className="stat-label">Columns Compared</div>
              </div>
            </div>

            {/* Results Table Toolbar */}
            <div className="results-toolbar">
              <div className="filter-tabs">
                <button
                  className={`filter-tab ${activeFilter === 'all' ? 'active' : ''}`}
                  onClick={() => {
                    setActiveFilter('all');
                    setCurrentPage(1);
                  }}
                >
                  All <span className="tab-count">{filterCounts.all}</span>
                </button>
                <button
                  className={`filter-tab ${activeFilter === 'mismatch' ? 'active' : ''}`}
                  onClick={() => {
                    setActiveFilter('mismatch');
                    setCurrentPage(1);
                  }}
                >
                  Mismatches <span className="tab-count">{filterCounts.mismatch}</span>
                </button>
                <button
                  className={`filter-tab ${activeFilter === 'match' ? 'active' : ''}`}
                  onClick={() => {
                    setActiveFilter('match');
                    setCurrentPage(1);
                  }}
                >
                  Matches <span className="tab-count">{filterCounts.match}</span>
                </button>
                <button
                  className={`filter-tab ${activeFilter === 'source_only' ? 'active' : ''}`}
                  onClick={() => {
                    setActiveFilter('source_only');
                    setCurrentPage(1);
                  }}
                >
                  Source Only <span className="tab-count">{filterCounts.source_only}</span>
                </button>
                <button
                  className={`filter-tab ${activeFilter === 'target_only' ? 'active' : ''}`}
                  onClick={() => {
                    setActiveFilter('target_only');
                    setCurrentPage(1);
                  }}
                >
                  Target Only <span className="tab-count">{filterCounts.target_only}</span>
                </button>
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
                <div style={{ position: 'relative' }}>
                  <Search size={14} style={{ position: 'absolute', left: '10px', top: '12px', color: 'var(--text-muted)' }} />
                  <input
                    className="results-search"
                    style={{ paddingLeft: '2rem' }}
                    type="search"
                    placeholder="Search keys or values..."
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setCurrentPage(1);
                    }}
                  />
                </div>

                <div className="download-btns">
                  <button className="btn btn-secondary btn-sm" onClick={() => downloadReport('csv')}>
                    <Download size={12} /> CSV
                  </button>
                  <button className="btn btn-secondary btn-sm" onClick={() => downloadReport('html')}>
                    <Download size={12} /> HTML
                  </button>
                </div>
              </div>
            </div>

            {/* Results Table */}
            <div className="table-wrapper">
              <table className="responsive-table">
                <thead>
                  <tr>
                    <th onClick={() => handleSort('key')} className={sortCol === 'key' ? 'sorted' : ''} style={{ width: '25%' }}>
                      Join Key <span className="sort-icon">{sortCol === 'key' && (sortAsc ? '↑' : '↓')}</span>
                    </th>
                    <th onClick={() => handleSort('status')} className={sortCol === 'status' ? 'sorted' : ''} style={{ width: '25%' }}>
                      Status <span className="sort-icon">{sortCol === 'status' && (sortAsc ? '↑' : '↓')}</span>
                    </th>
                    <th>Difference Summary (Click row to expand visual breakdown)</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedRows.length === 0 ? (
                    <tr>
                      <td colSpan={3}>
                        <div className="empty-state">
                          <div className="empty-icon">🔍</div>
                          <h3>No results match criteria</h3>
                          <p>Try clearing your search query or choosing another status filter above.</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    paginatedRows.map((row, idx) => <ResultRow key={row.key + '-' + idx} row={row} />)
                  )}
                </tbody>
              </table>

              {/* Pagination controls */}
              {totalPages > 1 && (
                <div className="pagination">
                  <button
                    className="page-btn"
                    disabled={activePage === 1}
                    onClick={() => setCurrentPage(activePage - 1)}
                  >
                    <ChevronLeft size={16} />
                  </button>

                  {getPageRange().map((p, idx) => {
                    if (p === '…') {
                      return (
                        <span key={'dots-' + idx} style={{ color: 'var(--text-muted)', padding: '0 0.4rem' }}>
                          …
                        </span>
                      );
                    }
                    return (
                      <button
                        key={'page-' + p}
                        className={`page-btn ${activePage === p ? 'active' : ''}`}
                        onClick={() => setCurrentPage(p)}
                      >
                        {p}
                      </button>
                    );
                  })}

                  <button
                    className="page-btn"
                    disabled={activePage === totalPages}
                    onClick={() => setCurrentPage(activePage + 1)}
                  >
                    <ChevronRight size={16} />
                  </button>

                  <span className="page-info">
                    {total} rows &bull; Page {activePage} of {totalPages}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer>
        <p>
          DataMatchX &mdash; Built with <a href="https://fastapi.tiangolo.com" target="_blank" rel="noopener noreferrer">FastAPI</a> + React &amp; Vanilla CSS &nbsp;|&nbsp;{' '}
          <a href={`${CONFIG.API_BASE.replace('/api', '')}/docs`} target="_blank" rel="noopener noreferrer">
            API Docs
          </a>
        </p>
      </footer>
    </div>
  );
}
