import React, { useRef, useState } from 'react';
import { Upload, FileText, X } from 'lucide-react';

export default function UploadZone({
  label,
  hint,
  accept,
  file,
  setFile,
  icon: IconComponent = Upload,
}) {
  const fileInputRef = useRef(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const handleZoneClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setFile(e.dataTransfer.files[0]);
    }
  };

  const removeFile = (e) => {
    e.stopPropagation();
    setFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const formatBytes = (bytes) => {
    if (bytes === 0) return '0 B';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1048576).toFixed(1) + ' MB';
  };

  return (
    <div
      className={`upload-zone ${file ? 'has-file' : ''} ${isDragOver ? 'drag-over' : ''}`}
      onClick={handleZoneClick}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      role="button"
      tabIndex={0}
      aria-label={`Upload ${label}`}
    >
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept={accept}
        style={{ display: 'none' }}
      />
      {file ? (
        <>
          <div className="zone-icon">
            <FileText size={40} className="text-green" style={{ color: 'var(--green)' }} />
          </div>
          <div className="zone-label" style={{ color: 'var(--green)' }}>{label} Added</div>
          <div className="zone-filename">
            📄 {file.name} ({formatBytes(file.size)})
          </div>
          <button className="remove-file-btn" onClick={removeFile}>
            Remove File
          </button>
        </>
      ) : (
        <>
          <div className="zone-icon">
            <IconComponent size={40} />
          </div>
          <div className="zone-label">{label}</div>
          <div className="zone-hint">{hint}</div>
        </>
      )}
    </div>
  );
}
