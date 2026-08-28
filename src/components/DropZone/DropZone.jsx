import { useState, useCallback, useRef } from 'react';
import { useLetterboxdData } from '../../hooks/useLetterboxdData';
import './DropZone.css';

const ACCEPTED_TYPE = '.zip';

/**
 * Render upload arrow SVG icon.
 *
 * Returns:
 *   JSX.Element: Vector SVG element.
 */
const UploadIcon = () => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="17 8 12 3 7 8" />
    <line x1="12" y1="3" x2="12" y2="15" />
  </svg>
);

/**
 * Render folder SVG icon.
 *
 * Returns:
 *   JSX.Element: Vector SVG element.
 */
const FolderIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
  </svg>
);

/**
 * Render shield SVG icon.
 *
 * Returns:
 *   JSX.Element: Vector SVG element.
 */
const ShieldIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
  </svg>
);

/**
 * DropZone upload screen component allowing drag-and-drop or file pick of Letterboxd ZIP export.
 *
 * Returns:
 *   JSX.Element: Interactive upload component with export steps.
 */
export default function DropZone() {
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef(null);
  const { processZip } = useLetterboxdData();

  /**
   * Validates and triggers parsing of selected file.
   *
   * Args:
   *   file (File): Candidate file object from drag-and-drop or file input.
   *
   * Returns:
   *   Promise<void>
   */
  const handleFile = useCallback(async (file) => {
    setError('');
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.zip')) {
      setError('Invalid file format. Please upload a .zip file exported from Letterboxd.');
      return;
    }
    try {
      await processZip(file);
    } catch (err) {
      // display exact custom error message thrown by zipParser
      setError(err?.message || 'Failed to read the ZIP file. Make sure it is a valid Letterboxd export.');
    }
  }, [processZip]);

  const onDragOver = useCallback((e) => {
    e.preventDefault();
    setDragging(true);
  }, []);

  const onDragLeave = useCallback((e) => {
    if (!e.currentTarget.contains(e.relatedTarget)) setDragging(false);
  }, []);

  const onDrop = useCallback((e) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    handleFile(file);
  }, [handleFile]);

  const onInputChange = useCallback((e) => {
    const file = e.target.files?.[0];
    handleFile(file);
  }, [handleFile]);

  return (
    <div className="dropzone-wrapper">
      {/* Header — Letterboxd Stats Analyser */}
      <div className="dropzone-header">
        <div className="dropzone-logo">
          <img src="/logo.png" alt="Letterboxd Stats Analyser Logo" className="dropzone-logo-img" />
          <span className="dropzone-logo-text">Letterboxd Stats Analyser</span>
        </div>
        <h1 className="dropzone-title">
          Your <span className="letterboxd-brand"><span className="lb-orange">letter</span><span className="lb-green">box</span><span className="lb-blue">d</span></span>,<br />
          <span className="unwrapped-highlight">Unwrapped</span>
        </h1>
        <p className="dropzone-subtitle">
          Drop your Letterboxd export ZIP here and let's dive into your film life.
        </p>
      </div>

      {/* Drop area */}
      <div
        className={`dropzone-area${dragging ? ' dragging' : ''}${error ? ' error' : ''}`}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        role="button"
        tabIndex={0}
        aria-label="Upload Letterboxd ZIP file"
        onKeyDown={(e) => e.key === 'Enter' && inputRef.current?.click()}
      >
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED_TYPE}
          className="dropzone-input"
          onChange={onInputChange}
          aria-hidden="true"
          tabIndex={-1}
        />

        <span className="dropzone-icon" style={{ color: dragging ? 'var(--color-accent)' : 'var(--color-text-muted)' }}>
          <UploadIcon />
        </span>

        <p className="dropzone-area-title">
          {dragging ? 'Release to start' : 'Drop your Letterboxd ZIP export here'}
        </p>
        <p className="dropzone-area-sub">
          Supports the official .zip file from your Letterboxd account settings
        </p>

        <p className="dropzone-or">or</p>

        <div className="dropzone-btn">
          <FolderIcon /> Select file from computer
        </div>

        {error && (
          <div className="dropzone-error-msg" role="alert">
            {error}
          </div>
        )}
      </div>

      {/* How to export guide */}
      <div className="dropzone-guide">
        <p className="dropzone-guide-title">How to export your data</p>
        <div className="dropzone-guide-steps">
          <div className="dropzone-guide-step">
            <span className="dropzone-guide-step-num">1</span>
            Go to letterboxd.com
          </div>
          <div className="dropzone-guide-step">
            <span className="dropzone-guide-step-num">2</span>
            Settings → Data → Export
          </div>
          <div className="dropzone-guide-step">
            <span className="dropzone-guide-step-num">3</span>
            Upload the .zip here
          </div>
        </div>
      </div>

      {/* Privacy note */}
      <p className="dropzone-privacy">
        <ShieldIcon /> Your data stays 100% in your browser. No servers, no tracking. Why would I want your letterboxd history lol?
      </p>
    </div>
  );
}
