import { useState, useCallback, useRef } from 'react';
import { useData } from '../../context/DataContext';
import { useLetterboxdData } from '../../hooks/useLetterboxdData';
import { UploadIcon } from '../icons/Icons';
import './DropZone.css';

const ACCEPTED_TYPE = '.zip';
const MOCK_ZIP_NAME = 'letterboxd-leotorol-2026-11-09-17-41-utc.zip';
const MOCK_ZIP_URL = `${import.meta.env.BASE_URL}mock-data/${MOCK_ZIP_NAME}`;

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
 * Render sparkles SVG icon for the mock data shortcut.
 *
 * Returns:
 *   JSX.Element: Vector SVG element.
 */
const SparkIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z" />
    <path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z" />
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
  const [loadingMock, setLoadingMock] = useState(false);
  const inputRef = useRef(null);
  const { processZip } = useLetterboxdData();
  const { importError, setImportError } = useData();
  const shownError = error || importError;

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
    setImportError('');
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
  }, [processZip, setImportError]);

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

  /**
   * Fetches the bundled demo export and feeds it through the normal upload flow.
   *
   * Lets anyone explore the app without exporting their own Letterboxd account.
   *
   * Returns:
   *   Promise<void>
   */
  const handleMockData = useCallback(async () => {
    if (loadingMock) return;
    setError('');
    setImportError('');
    setLoadingMock(true);
    try {
      const response = await fetch(MOCK_ZIP_URL);
      if (!response.ok) throw new Error('Could not load the demo export. Please try again.');
      const blob = await response.blob();
      const file = new File([blob], MOCK_ZIP_NAME, { type: 'application/zip' });
      await processZip(file);
    } catch (err) {
      setLoadingMock(false);
      setError(err?.message || 'Could not load the demo export. Please try again.');
    }
  }, [loadingMock, processZip, setImportError]);

  return (
    <div className="dropzone-wrapper">
      <button
        type="button"
        className="dropzone-mock-btn"
        onClick={handleMockData}
        disabled={loadingMock}
        aria-busy={loadingMock}
      >
        {loadingMock ? <span className="dropzone-mock-spinner" aria-hidden="true" /> : <SparkIcon />}
        {loadingMock ? 'Loading mock data' : 'Use mock data'}
      </button>

      {/* Header — Letterboxd Stats Analyser */}
      <div className="dropzone-header">
        <div className="dropzone-logo">
          <img
            src="/logo.png"
            alt="Letterboxd Stats Analyser logo"
            className="dropzone-logo-img"
            width="400"
            height="400"
            loading="eager"
            decoding="async"
            fetchPriority="high"
          />
          <span className="dropzone-logo-text">Letterboxd Stats Analyser</span>
        </div>
        <h1 className="dropzone-title">
          Your <span className="letterboxd-brand"><span className="lb-orange">letter</span><span className="lb-green">box</span><span className="lb-blue">d</span></span>,<br />
          <span className="unwrapped-highlight">Unwrapped</span>
        </h1>
        <p className="dropzone-subtitle">
          Drop your Letterboxd export ZIP and explore your film history.
        </p>
      </div>

      {/* Drop area */}
      <div
        className={`dropzone-area${dragging ? ' dragging' : ''}${shownError ? ' error' : ''}`}
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
          <UploadIcon size={28} />
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

        {shownError && (
          <div className="dropzone-error-msg" role="alert">
            {shownError}
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
        <ShieldIcon /> Your export is parsed in your browser. Only film titles and years reach TMDB for metadata, your account data never leaves this device.
      </p>
    </div>
  );
}
