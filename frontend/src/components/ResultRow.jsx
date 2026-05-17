import React, { useState } from 'react';
import { ChevronDown, ChevronUp, AlertTriangle, CheckCircle, HelpCircle, ArrowRight } from 'lucide-react';

export default function ResultRow({ row }) {
  const [isExpanded, setIsExpanded] = useState(false);

  const getStatusBadgeClass = (status) => {
    switch (status) {
      case 'match':
        return 'badge-match';
      case 'mismatch':
        return 'badge-mismatch';
      case 'source_only':
        return 'badge-source_only';
      case 'target_only':
        return 'badge-target_only';
      default:
        return '';
    }
  };

  const getStatusLabel = (status) => {
    return status
      .replace('_', ' ')
      .replace(/\b\w/g, (l) => l.toUpperCase());
  };

  // Compile list of mismatched columns for preview
  const mismatches = (row.diffs || []).filter((d) => !d.matched);

  return (
    <>
      <tr
        className="clickable-row"
        onClick={() => setIsExpanded(!isExpanded)}
        style={{
          borderLeft: isExpanded ? '3px solid var(--accent)' : '3px solid transparent',
        }}
      >
        <td className="key-cell">
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
            {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            {String(row.key)}
          </span>
        </td>
        <td>
          <span className={`badge ${getStatusBadgeClass(row.status)}`}>
            {getStatusLabel(row.status)}
          </span>
        </td>
        <td>
          {row.status === 'source_only' && (
            <span className="diff-preview-text" style={{ color: 'var(--yellow)' }}>
              ⚠ Row exists in source only
            </span>
          )}
          {row.status === 'target_only' && (
            <span className="diff-preview-text" style={{ color: 'var(--blue)' }}>
              ⊕ Row exists in target only
            </span>
          )}
          {row.status === 'match' && (
            <span className="all-match">✓ All columns match</span>
          )}
          {row.status === 'mismatch' && (
            <div className="diff-preview-text">
              <span className="mismatched-preview">
                ⚡ {mismatches.length} column mismatch{mismatches.length > 1 ? 'es' : ''} (click to view details)
              </span>
            </div>
          )}
        </td>
      </tr>

      {/* Expanded visual side-by-side diff */}
      {isExpanded && (
        <tr>
          <td colSpan={3} className="expanded-diff-cell">
            <div className="expanded-diff-container">
              <div className="expanded-diff-header">
                <h4>
                  🔍 Record Breakdown — <span className="key-cell">{String(row.key)}</span>
                </h4>
                <span>Status: <strong style={{ textTransform: 'capitalize' }}>{row.status.replace('_', ' ')}</strong></span>
              </div>

              {row.status === 'source_only' && (
                <div className="empty-state" style={{ padding: '2rem' }}>
                  <div className="empty-icon">📂</div>
                  <h3>Source-Only Record</h3>
                  <p>This row (Primary Key: <strong>{String(row.key)}</strong>) exists in the Source dataset but is missing from the Target dataset.</p>
                </div>
              )}

              {row.status === 'target_only' && (
                <div className="empty-state" style={{ padding: '2rem' }}>
                  <div className="empty-icon">🎯</div>
                  <h3>Target-Only Record</h3>
                  <p>This row (Primary Key: <strong>{String(row.key)}</strong>) exists in the Target dataset but is missing from the Source dataset.</p>
                </div>
              )}

              {(row.status === 'match' || row.status === 'mismatch') && (
                <div className="diff-grid">
                  {row.diffs.map((diff, index) => {
                    const isMatched = diff.matched;

                    return (
                      <div
                        key={index}
                        className={`diff-grid-item ${
                          isMatched ? 'matched-field' : 'mismatched-field'
                        }`}
                      >
                        <div className="diff-field-name">
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                            {isMatched ? (
                              <CheckCircle size={13} style={{ color: 'var(--green)' }} />
                            ) : (
                              <AlertTriangle size={13} style={{ color: 'var(--red)' }} />
                            )}
                            {diff.column}
                          </span>
                          <span className="diff-field-rule-badge">{diff.rule}</span>
                        </div>

                        <div className="diff-comparison-block">
                          {isMatched ? (
                            <div className="diff-val-box matched-val">
                              <span className="diff-val-box-label" style={{ background: 'rgba(34, 197, 94, 0.2)' }}>
                                OK
                              </span>
                              <span className="diff-val-box-value">{String(diff.source_value)}</span>
                            </div>
                          ) : (
                            <>
                              {/* Source Value (Orange/Yellow) */}
                              <div className="diff-val-box source-val">
                                <span className="diff-val-box-label" style={{ background: 'rgba(245, 158, 11, 0.2)' }}>
                                  SRC
                                </span>
                                <span className="diff-val-box-value">
                                  {diff.source_value === '' ? <em style={{ opacity: 0.5 }}>empty</em> : String(diff.source_value)}
                                </span>
                              </div>

                              <div style={{ display: 'flex', justifyContent: 'center', color: 'var(--text-muted)' }}>
                                <ArrowRight size={14} />
                              </div>

                              {/* Target Value (Red) */}
                              <div className="diff-val-box target-val">
                                <span className="diff-val-box-label" style={{ background: 'rgba(239, 68, 68, 0.2)' }}>
                                  TGT
                                </span>
                                <span className="diff-val-box-value">
                                  {diff.target_value === '' ? <em style={{ opacity: 0.5 }}>empty</em> : String(diff.target_value)}
                                </span>
                              </div>

                              {/* Rule Mismatch Detail */}
                              {diff.detail && (
                                <div className="diff-explanation">
                                  <HelpCircle size={11} /> {diff.detail}
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
