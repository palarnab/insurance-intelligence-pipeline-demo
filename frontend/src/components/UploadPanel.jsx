import { useRef, useState } from 'react';
import { api } from '../api.js';

export default function UploadPanel({ onUploaded, onError }) {
  const [dragOver, setDragOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef(null);

  const handleFiles = async (files) => {
    const file = files?.[0];
    if (!file) return;
    setBusy(true);
    onError(null);
    try {
      const res = await api.uploadDocument(file);
      await onUploaded(res.documentId);
    } catch (e) {
      onError(e.message);
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <div
      className={`upload ${dragOver ? 'drag' : ''} ${busy ? 'busy' : ''}`}
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        handleFiles(e.dataTransfer.files);
      }}
      onClick={() => inputRef.current?.click()}
      role="button"
    >
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,image/png,image/jpeg,image/tiff"
        hidden
        onChange={(e) => handleFiles(e.target.files)}
      />
      <div className="upload-icon">{busy ? '⏳' : '⬆'}</div>
      <div className="upload-text">
        <strong>{busy ? 'Uploading…' : 'Drop an insurance document'}</strong>
        <span>PDF, PNG, JPEG or TIFF · single page · up to 10 MB</span>
      </div>
    </div>
  );
}
