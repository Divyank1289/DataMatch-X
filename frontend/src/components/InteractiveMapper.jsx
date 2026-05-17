import React from 'react';
import { Plus, Trash2, ShieldAlert, Sparkles } from 'lucide-react';

export default function InteractiveMapper({
  sourceCols = [],
  targetCols = [],
  mapping,
  setMapping,
  onToast,
}) {
  // Update key fields
  const handleKeyChange = (field, val) => {
    setMapping((prev) => ({
      ...prev,
      [field]: val,
    }));
  };

  // Add a new column mapping row
  const addRow = () => {
    setMapping((prev) => ({
      ...prev,
      columns: [
        ...prev.columns,
        { source: '', target: '', rule: 'exact', tolerance: null, pattern: '' },
      ],
    }));
  };

  // Update a column mapping row field
  const handleRowChange = (index, field, val) => {
    setMapping((prev) => {
      const newCols = [...prev.columns];
      newCols[index] = {
        ...newCols[index],
        [field]: val,
      };
      return {
        ...prev,
        columns: newCols,
      };
    });
  };

  // Delete a column mapping row
  const deleteRow = (index) => {
    setMapping((prev) => {
      const newCols = prev.columns.filter((_, i) => i !== index);
      return {
        ...prev,
        columns: newCols,
      };
    });
  };

  // Premium feature: Smart Auto-Mapping
  const runAutoMap = () => {
    if (!sourceCols.length || !targetCols.length) {
      onToast('❌ Source and Target files must be loaded first!', 'error');
      return;
    }

    let detectedSrcKey = '';
    let detectedTgtKey = '';
    const mappedCols = [];

    // 1. Detect Join Keys
    const keyPatterns = ['id', 'key', 'code', 'uid', 'number', 'no'];
    
    // Check for exact matching keys in both lists
    for (const pattern of keyPatterns) {
      const srcMatch = sourceCols.find(c => String(c).toLowerCase() === pattern);
      const tgtMatch = targetCols.find(c => String(c).toLowerCase() === pattern);
      if (srcMatch && tgtMatch) {
        detectedSrcKey = String(srcMatch);
        detectedTgtKey = String(tgtMatch);
        break;
      }
    }

    // Fallback: check matching columns that contain 'id' or 'key'
    if (!detectedSrcKey) {
      for (const pattern of keyPatterns) {
        const srcMatch = sourceCols.find(c => String(c).toLowerCase().includes(pattern));
        if (srcMatch) {
          const tgtMatch = targetCols.find(c => {
            const s = String(c).toLowerCase();
            return s.includes(pattern) && s.replace(pattern, '') === String(srcMatch).toLowerCase().replace(pattern, '');
          });
          if (tgtMatch) {
            detectedSrcKey = String(srcMatch);
            detectedTgtKey = String(tgtMatch);
            break;
          }
        }
      }
    }

    // Default Fallback: First column
    if (!detectedSrcKey) {
      detectedSrcKey = String(sourceCols[0] || '');
      detectedTgtKey = String(targetCols[0] || '');
    }

    // Helper to normalize column names for matching
    const normalize = (str) => String(str).toLowerCase().replace(/[^a-z0-9]/g, '');

    // 2. Map Columns
    sourceCols.forEach((srcColRaw) => {
      const srcCol = String(srcColRaw);
      // Don't map the join keys as ordinary columns
      if (srcCol === detectedSrcKey) return;

      const normSrc = normalize(srcCol);

      // Try exact case-insensitive match
      let match = targetCols.find(t => String(t).toLowerCase() === srcCol.toLowerCase() && String(t) !== detectedTgtKey);

      // Try normalized match
      if (!match) {
        match = targetCols.find(t => normalize(t) === normSrc && String(t) !== detectedTgtKey);
      }

      // Try containing match
      if (!match) {
        match = targetCols.find(t => (normalize(t).includes(normSrc) || normSrc.includes(normalize(t))) && String(t) !== detectedTgtKey);
      }

      // Detect rule automatically
      let rule = 'exact';
      let tolerance = null;

      // Auto-detect numeric fields for tolerance (e.g. salary, price, cost, amount)
      const numericIndicators = ['salary', 'price', 'cost', 'amount', 'rate', 'val', 'balance'];
      if (numericIndicators.some(ind => srcCol.toLowerCase().includes(ind))) {
        rule = 'numeric_tolerance';
        tolerance = 0.0;
      }

      mappedCols.push({
        source: srcCol,
        target: match ? String(match) : '',
        rule: rule,
        tolerance: tolerance,
        pattern: '',
      });
    });

    setMapping({
      version: '1.0',
      source_key: detectedSrcKey,
      target_key: detectedTgtKey,
      columns: mappedCols,
    });

    const pairedCount = mappedCols.filter(c => c.target !== '').length;
    onToast(`✨ Smart Auto-Map populated all ${mappedCols.length} columns (paired ${pairedCount} matching automatically)!`, 'success');
  };

  return (
    <div className="mapper-card">
      <div className="mapper-header">
        <div className="mapper-title-area">
          <h3>🗺 Columns Mapping Configuration</h3>
          <p>Visually configure how columns match between the source and target files and apply specific validation rules.</p>
        </div>
        <button className="auto-map-btn" onClick={runAutoMap}>
          <Sparkles size={14} /> Smart Auto-Map
        </button>
      </div>

      {/* Primary Join Keys Selector */}
      <div className="mapper-keys-row">
        <div className="mapper-field">
          <label>Source Primary Key</label>
          <select
            className="mapper-select"
            value={mapping.source_key}
            onChange={(e) => handleKeyChange('source_key', e.target.value)}
          >
            <option value="">-- Select Source Join Column --</option>
            {sourceCols.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        <div className="mapper-field">
          <label>Target Primary Key</label>
          <select
            className="mapper-select"
            value={mapping.target_key}
            onChange={(e) => handleKeyChange('target_key', e.target.value)}
          >
            <option value="">-- Select Target Join Column --</option>
            {targetCols.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Column Pairings List */}
      <div className="columns-mapping-section">
        {mapping.columns.map((col, idx) => (
          <div key={idx} className="mapper-row-item">
            <div className="mapper-row-inputs">
              {/* Source Column Dropdown */}
              <div className="mapper-field">
                <select
                  className="mapper-select"
                  value={col.source}
                  onChange={(e) => handleRowChange(idx, 'source', e.target.value)}
                >
                  <option value="">-- Source Column --</option>
                  {sourceCols.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              {/* Target Column Dropdown */}
              <div className="mapper-field">
                <select
                  className="mapper-select"
                  value={col.target}
                  onChange={(e) => handleRowChange(idx, 'target', e.target.value)}
                >
                  <option value="">-- Target Column --</option>
                  {targetCols.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              {/* Comparison Rule Selector */}
              <div className="mapper-field">
                <select
                  className="mapper-select"
                  value={col.rule}
                  onChange={(e) => handleRowChange(idx, 'rule', e.target.value)}
                >
                  <option value="exact">exact</option>
                  <option value="case_insensitive">case_insensitive</option>
                  <option value="numeric_tolerance">numeric_tolerance</option>
                  <option value="regex">regex</option>
                  <option value="ignore">ignore</option>
                </select>
              </div>

              {/* Conditional Inputs */}
              <div className="mapper-field">
                {col.rule === 'numeric_tolerance' && (
                  <input
                    type="number"
                    className="mapper-input"
                    placeholder="Tolerance (e.g. 0.1)"
                    step="any"
                    value={col.tolerance === null ? '' : col.tolerance}
                    onChange={(e) =>
                      handleRowChange(
                        idx,
                        'tolerance',
                        e.target.value === '' ? null : parseFloat(e.target.value)
                      )
                    }
                  />
                )}
                {col.rule === 'regex' && (
                  <input
                    type="text"
                    className="mapper-input"
                    placeholder="Pattern (e.g. ^\\d+$)"
                    value={col.pattern || ''}
                    onChange={(e) => handleRowChange(idx, 'pattern', e.target.value)}
                  />
                )}
                {col.rule !== 'numeric_tolerance' && col.rule !== 'regex' && (
                  <input
                    type="text"
                    className="mapper-input"
                    disabled
                    placeholder="No parameters"
                    value=""
                  />
                )}
              </div>
            </div>

            <button
              className="mapper-row-delete-btn"
              onClick={() => deleteRow(idx)}
              title="Delete mapping row"
            >
              <Trash2 size={16} />
            </button>
          </div>
        ))}
      </div>

      <button className="add-mapping-btn" onClick={addRow}>
        <Plus size={16} /> Add Column Mapping Pairing
      </button>
    </div>
  );
}
