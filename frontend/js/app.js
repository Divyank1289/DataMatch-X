/**
 * DataMatchX — Frontend Application Logic
 * Handles file uploads, API communication, results rendering, filtering, pagination
 */

const API_BASE = 'http://127.0.0.1:8000/api';
const PAGE_SIZE = 20;

// ── State ──────────────────────────────────────────────────────────────────
const state = {
  files: { source: null, target: null, mapping: null },
  results: [],
  filteredResults: [],
  summary: null,
  reportId: null,
  currentPage: 1,
  activeFilter: 'all',
  sortCol: null,
  sortAsc: true,
  searchQuery: '',
};

// ── DOM Refs ───────────────────────────────────────────────────────────────
const $  = id => document.getElementById(id);
const $$ = sel => document.querySelectorAll(sel);

// ── Init ───────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  setupDropZones();
  setupFilters();
  setupSearch();
  setupSort();
  $('compareBtn').addEventListener('click', runComparison);
  $('validateBtn').addEventListener('click', runValidation);
  $('resetBtn').addEventListener('click', resetAll);
  $('dlCsv').addEventListener('click', () => downloadReport('csv'));
  $('dlHtml').addEventListener('click', () => downloadReport('html'));
});

// ── Drop Zones ─────────────────────────────────────────────────────────────
function setupDropZones() {
  const zones = [
    { zoneId: 'sourceZone', inputId: 'sourceInput', key: 'source' },
    { zoneId: 'targetZone', inputId: 'targetInput', key: 'target' },
    { zoneId: 'mappingZone', inputId: 'mappingInput', key: 'mapping' },
  ];

  zones.forEach(({ zoneId, inputId, key }) => {
    const zone = $(zoneId);
    const input = $(inputId);

    zone.addEventListener('click', () => input.click());
    input.addEventListener('change', () => {
      if (input.files[0]) setFile(key, input.files[0], zone);
    });

    zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('drag-over'); });
    zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
    zone.addEventListener('drop', e => {
      e.preventDefault();
      zone.classList.remove('drag-over');
      const file = e.dataTransfer.files[0];
      if (file) { input.files = e.dataTransfer.files; setFile(key, file, zone); }
    });
  });
}

function setFile(key, file, zone) {
  state.files[key] = file;
  zone.classList.add('has-file');
  zone.querySelector('.zone-filename').textContent = `📄 ${file.name} (${formatBytes(file.size)})`;
  updateCompareBtn();
}

function updateCompareBtn() {
  const ready = state.files.source && state.files.target && state.files.mapping;
  $('compareBtn').disabled = !ready;
  $('validateBtn').disabled = !ready;
}

// ── Comparison ─────────────────────────────────────────────────────────────
async function runComparison() {
  if (!state.files.source || !state.files.target || !state.files.mapping) return;

  showLoading(true);
  hideError();
  hideResults();

  const form = new FormData();
  form.append('source', state.files.source);
  form.append('target', state.files.target);
  form.append('mapping', state.files.mapping);

  const srcSheet = $('sourceSheet').value.trim();
  const tgtSheet = $('targetSheet').value.trim();
  if (srcSheet) form.append('source_sheet', srcSheet);
  if (tgtSheet) form.append('target_sheet', tgtSheet);

  animateLoadingSteps();

  try {
    const res = await fetch(`${API_BASE}/compare`, { method: 'POST', body: form });
    const data = await res.json();

    if (!res.ok) {
      const msg = data.detail?.message || data.detail || JSON.stringify(data);
      const errs = data.detail?.errors ? '\n• ' + data.detail.errors.join('\n• ') : '';
      showError('Comparison Failed', msg + errs);
      return;
    }

    state.results = data.results || [];
    state.summary = data.summary;
    state.reportId = data.report_id;
    state.currentPage = 1;
    state.activeFilter = 'all';
    state.searchQuery = '';
    $('searchInput').value = '';

    applyFilters();
    renderSummary(data.summary, data.source_format, data.target_format);
    showResults();
    toast(`✓ Comparison complete — Report ID: ${state.reportId}`, 'success');
    $('dlCsv').disabled = false;
    $('dlHtml').disabled = false;

  } catch (err) {
    showError('Network Error', err.message);
    toast('❌ Failed to reach the backend. Is the server running?', 'error');
  } finally {
    showLoading(false);
  }
}

// ── Validation ─────────────────────────────────────────────────────────────
async function runValidation() {
  if (!state.files.source || !state.files.target || !state.files.mapping) return;
  showLoading(true); hideError();

  const form = new FormData();
  form.append('source', state.files.source);
  form.append('target', state.files.target);
  form.append('mapping', state.files.mapping);

  try {
    const res = await fetch(`${API_BASE}/validate`, { method: 'POST', body: form });
    const data = await res.json();

    if (!res.ok) {
      showError('Validation Request Failed', JSON.stringify(data.detail));
      return;
    }

    if (data.valid) {
      toast(`✓ Mapping valid — ${data.column_count} columns mapped. Source key: "${data.source_key}", Target key: "${data.target_key}"`, 'success');
    } else {
      const errMsg = data.errors.map(e => `• ${e}`).join('\n');
      showError('Mapping Validation Failed', errMsg);
      toast('❌ Mapping has errors — see details above', 'error');
    }
    if (data.warnings?.length) {
      data.warnings.forEach(w => toast(`⚠ ${w}`, 'info'));
    }
  } catch (err) {
    showError('Network Error', err.message);
  } finally {
    showLoading(false);
  }
}

// ── Summary Render ─────────────────────────────────────────────────────────
function renderSummary(s, srcFmt, tgtFmt) {
  const cards = [
    { id: 'statMatched',    value: s.matched_rows,        label: 'Matched',       icon: '✓', color: 'var(--green)' },
    { id: 'statMismatched', value: s.mismatched_rows,     label: 'Mismatched',    icon: '✗', color: 'var(--red)'   },
    { id: 'statSrcOnly',    value: s.source_only_rows,    label: 'Source Only',   icon: '◈', color: 'var(--yellow)'},
    { id: 'statTgtOnly',    value: s.target_only_rows,    label: 'Target Only',   icon: '◆', color: 'var(--blue)'  },
    { id: 'statRate',       value: s.match_rate_pct + '%',label: 'Match Rate',    icon: '⬡', color: 'var(--accent)'},
    { id: 'statCols',       value: s.total_columns_compared, label: 'Cols Compared', icon: '⊞', color: 'var(--accent-3)'},
  ];

  cards.forEach(c => {
    const el = $(c.id);
    if (!el) return;
    el.querySelector('.stat-value').textContent = c.value;
    el.querySelector('.stat-value').style.color = c.color;
    el.style.setProperty('--accent-color', c.color);
  });

  $('reportMeta').textContent =
    `Report ID: ${state.reportId}  |  Source: ${(srcFmt||'').toUpperCase()}  |  Target: ${(tgtFmt||'').toUpperCase()}  |  ${s.total_source_rows} source rows vs ${s.total_target_rows} target rows`;

  // Update filter tab counts
  const counts = { all: state.results.length };
  state.results.forEach(r => { counts[r.status] = (counts[r.status] || 0) + 1; });
  $$('.filter-tab').forEach(tab => {
    const f = tab.dataset.filter;
    const count = counts[f] || 0;
    tab.querySelector('.tab-count').textContent = f === 'all' ? state.results.length : count;
  });
}

// ── Filter & Search ────────────────────────────────────────────────────────
function setupFilters() {
  $$('.filter-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      $$('.filter-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      state.activeFilter = tab.dataset.filter;
      state.currentPage = 1;
      applyFilters();
    });
  });
}

function setupSearch() {
  $('searchInput').addEventListener('input', e => {
    state.searchQuery = e.target.value.toLowerCase();
    state.currentPage = 1;
    applyFilters();
  });
}

function applyFilters() {
  let rows = state.results;
  if (state.activeFilter !== 'all') {
    rows = rows.filter(r => r.status === state.activeFilter);
  }
  if (state.searchQuery) {
    rows = rows.filter(r => {
      const keyMatch = String(r.key).toLowerCase().includes(state.searchQuery);
      const diffMatch = r.diffs?.some(d =>
        String(d.source_value).toLowerCase().includes(state.searchQuery) ||
        String(d.target_value).toLowerCase().includes(state.searchQuery) ||
        d.column.toLowerCase().includes(state.searchQuery)
      );
      return keyMatch || diffMatch;
    });
  }
  state.filteredResults = rows;
  renderTable();
}

// ── Sorting ────────────────────────────────────────────────────────────────
function setupSort() {
  $$('th[data-col]').forEach(th => {
    th.addEventListener('click', () => {
      const col = th.dataset.col;
      if (state.sortCol === col) state.sortAsc = !state.sortAsc;
      else { state.sortCol = col; state.sortAsc = true; }
      $$('th[data-col]').forEach(t => t.classList.remove('sorted'));
      th.classList.add('sorted');
      th.querySelector('.sort-arrow').textContent = state.sortAsc ? '↑' : '↓';
      sortResults();
      renderTable();
    });
  });
}

function sortResults() {
  state.filteredResults.sort((a, b) => {
    let va = state.sortCol === 'key' ? String(a.key) : a.status;
    let vb = state.sortCol === 'key' ? String(b.key) : b.status;
    const cmp = va.localeCompare(vb);
    return state.sortAsc ? cmp : -cmp;
  });
}

// ── Table Render ───────────────────────────────────────────────────────────
function renderTable() {
  const tbody = $('resultsBody');
  const total = state.filteredResults.length;
  const totalPages = Math.ceil(total / PAGE_SIZE) || 1;
  state.currentPage = Math.min(state.currentPage, totalPages);
  const start = (state.currentPage - 1) * PAGE_SIZE;
  const page = state.filteredResults.slice(start, start + PAGE_SIZE);

  if (page.length === 0) {
    tbody.innerHTML = `<tr><td colspan="3">
      <div class="empty-state">
        <div class="empty-icon">🔍</div>
        <h3>No results found</h3>
        <p>Try adjusting your filter or search term.</p>
      </div></td></tr>`;
    renderPagination(0, 1);
    return;
  }

  tbody.innerHTML = page.map(row => {
    const badgeCls = `badge-${row.status}`;
    const statusLabel = row.status.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
    const diffHtml = buildDiffHtml(row);
    return `<tr>
      <td class="key-cell">${escHtml(String(row.key))}</td>
      <td><span class="badge ${badgeCls}">${statusLabel}</span></td>
      <td>${diffHtml}</td>
    </tr>`;
  }).join('');

  renderPagination(total, totalPages);
}

function buildDiffHtml(row) {
  if (row.status === 'source_only') return `<span style="color:var(--yellow);font-size:.82rem">⚠ Row exists in source only</span>`;
  if (row.status === 'target_only') return `<span style="color:var(--blue);font-size:.82rem">⊕ Row exists in target only</span>`;
  if (row.status === 'match') return `<span class="all-match">✓ All columns match</span>`;

  const mismatches = (row.diffs || []).filter(d => !d.matched);
  if (!mismatches.length) return `<span class="all-match">✓ All columns match</span>`;

  return `<div class="diff-list">${mismatches.map(d => `
    <div class="diff-item">
      <span class="diff-col">${escHtml(d.column)}:</span>
      <span class="diff-src">${escHtml(String(d.source_value))}</span>
      <span class="diff-arrow">→</span>
      <span class="diff-tgt">${escHtml(String(d.target_value))}</span>
      ${d.detail ? `<div class="diff-detail">${escHtml(d.detail)}</div>` : ''}
    </div>`).join('')}
  </div>`;
}

// ── Pagination ─────────────────────────────────────────────────────────────
function renderPagination(total, totalPages) {
  $('paginationInfo').textContent = `${total} rows — Page ${state.currentPage} of ${totalPages}`;
  const container = $('paginationBtns');
  container.innerHTML = '';

  const makeBtn = (label, page, disabled = false, active = false) => {
    const btn = document.createElement('button');
    btn.className = 'page-btn' + (active ? ' active' : '');
    btn.textContent = label;
    btn.disabled = disabled;
    btn.addEventListener('click', () => { state.currentPage = page; renderTable(); });
    return btn;
  };

  container.appendChild(makeBtn('‹', state.currentPage - 1, state.currentPage === 1));

  const range = pageRange(state.currentPage, totalPages);
  range.forEach(p => {
    if (p === '…') {
      const span = document.createElement('span');
      span.textContent = '…'; span.style.color = 'var(--text-muted)';
      container.appendChild(span);
    } else {
      container.appendChild(makeBtn(p, p, false, p === state.currentPage));
    }
  });

  container.appendChild(makeBtn('›', state.currentPage + 1, state.currentPage === totalPages));
}

function pageRange(cur, total) {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  if (cur <= 4) return [1, 2, 3, 4, 5, '…', total];
  if (cur >= total - 3) return [1, '…', total-4, total-3, total-2, total-1, total];
  return [1, '…', cur-1, cur, cur+1, '…', total];
}

// ── Download ────────────────────────────────────────────────────────────────
async function downloadReport(type) {
  if (!state.reportId) return;
  try {
    const res = await fetch(`${API_BASE}/report/${state.reportId}/${type}`);
    if (!res.ok) throw new Error(await res.text());
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `datamatchx_${state.reportId}.${type}`;
    a.click(); URL.revokeObjectURL(url);
    toast(`✓ Downloaded ${type.toUpperCase()} report`, 'success');
  } catch (err) {
    toast(`❌ Download failed: ${err.message}`, 'error');
  }
}

// ── Loading Animation ──────────────────────────────────────────────────────
function showLoading(show) {
  $('loadingOverlay').classList.toggle('visible', show);
  $('compareBtn').disabled = show;
  $('validateBtn').disabled = show;
}

function animateLoadingSteps() {
  const steps = $$('.step-chip');
  let i = 0;
  steps.forEach(s => s.className = 'step-chip');
  const interval = setInterval(() => {
    if (i > 0) steps[i - 1].classList.replace('active', 'done');
    if (i < steps.length) { steps[i].classList.add('active'); i++; }
    else clearInterval(interval);
  }, 400);
}

// ── Visibility Helpers ─────────────────────────────────────────────────────
function showResults() { $('resultsSection').classList.add('visible'); }
function hideResults() { $('resultsSection').classList.remove('visible'); }
function showError(title, msg) {
  $('errorBox').classList.add('visible');
  $('errorTitle').textContent = title;
  $('errorMsg').textContent = msg;
  $('errorBox').scrollIntoView({ behavior: 'smooth', block: 'center' });
}
function hideError() { $('errorBox').classList.remove('visible'); }

function resetAll() {
  state.files = { source: null, target: null, mapping: null };
  state.results = []; state.filteredResults = []; state.summary = null;
  state.reportId = null; state.currentPage = 1;
  $$('.upload-zone').forEach(z => {
    z.classList.remove('has-file', 'drag-over');
    z.querySelector('.zone-filename').textContent = '';
  });
  $$('input[type=file]').forEach(i => i.value = '');
  hideResults(); hideError();
  $('compareBtn').disabled = true;
  $('validateBtn').disabled = true;
  $('dlCsv').disabled = true;
  $('dlHtml').disabled = true;
  toast('🔄 Reset complete', 'info');
}

// ── Toast ──────────────────────────────────────────────────────────────────
function toast(msg, type = 'info', duration = 4000) {
  const container = $('toastContainer');
  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  el.textContent = msg;
  container.appendChild(el);
  setTimeout(() => {
    el.style.animation = 'slideOut 0.3s ease forwards';
    setTimeout(() => el.remove(), 300);
  }, duration);
}

// ── Utils ──────────────────────────────────────────────────────────────────
function escHtml(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function formatBytes(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1048576).toFixed(1) + ' MB';
}
