'use client';
import { useEffect, useState } from 'react';
import Modal from '../ui/Modal.js';
import { getApiError } from '../../lib/api.js';
import {
  canPreviewDocument,
  createDocumentPreviewSource,
  documentFileName,
  formatFileSize,
  openDocument,
  downloadDocument,
} from '../../lib/services/documents.js';

export default function DocumentPreviewModal({ doc, onClose }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState(null);
  const [opening, setOpening] = useState(false);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    if (!doc?.id) return undefined;
    let cancelled = false;
    let revoke = null;

    setLoading(true);
    setError('');
    setPreview(null);

    createDocumentPreviewSource(doc)
      .then((source) => {
        if (cancelled) {
          source.revoke();
          return;
        }
        revoke = source.revoke;
        setPreview(source);
      })
      .catch((err) => {
        if (!cancelled) setError(getApiError(err) || 'Could not load preview');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
      revoke?.();
    };
  }, [doc]);

  const handleOpen = async () => {
    setOpening(true);
    try {
      await openDocument(doc);
    } catch (err) {
      setError(getApiError(err) || 'Could not open file');
    } finally {
      setOpening(false);
    }
  };

  const handleDownload = async () => {
    setDownloading(true);
    try {
      await downloadDocument(doc.id, documentFileName(doc));
    } catch (err) {
      setError(getApiError(err) || 'Could not download file');
    } finally {
      setDownloading(false);
    }
  };

  const previewable = canPreviewDocument(doc);
  const fileLabel = documentFileName(doc);

  return (
    <Modal title={fileLabel} onClose={onClose} wide>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-zoho-muted">
            {[doc.file_type || doc.mime_type, formatFileSize(doc.file_size)]
              .filter((part) => part && part !== '—')
              .join(' · ') || 'File'}
          </p>
          <div className="flex items-center gap-2">
            <button type="button" onClick={handleOpen} disabled={opening} className="btn-secondary text-xs">
              {opening ? 'Opening…' : 'Open file'}
            </button>
            <button type="button" onClick={handleDownload} disabled={downloading} className="btn-primary text-xs">
              {downloading ? 'Downloading…' : 'Download'}
            </button>
          </div>
        </div>

        {loading && <p className="text-sm text-zoho-muted py-10 text-center">Loading preview…</p>}

        {!loading && error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {!loading && !error && previewable && preview?.mode === 'pdf' && (
          <iframe
            title={fileLabel}
            src={preview.url}
            className="w-full h-[70vh] rounded-lg border border-zoho-border bg-white"
          />
        )}

        {!loading && !error && previewable && preview?.mode === 'image' && (
          <div className="flex items-center justify-center rounded-lg border border-zoho-border bg-zinc-50 p-4 min-h-[320px]">
            <img src={preview.url} alt={fileLabel} className="max-h-[70vh] max-w-full object-contain" />
          </div>
        )}

        {!loading && !error && previewable && preview?.mode === 'text' && (
          <pre className="max-h-[70vh] overflow-auto rounded-lg border border-zoho-border bg-zinc-50 p-4 text-xs whitespace-pre-wrap break-words">
            {preview.textContent}
          </pre>
        )}

        {!loading && !error && !previewable && (
          <div className="rounded-lg border border-zoho-border bg-zinc-50 px-4 py-10 text-center">
            <p className="text-sm text-zoho-text font-medium">Preview is not available for this file type in the browser.</p>
            <p className="text-xs text-zoho-muted mt-2">Use Open file to launch it in PowerPoint, Word, Excel, or your default app.</p>
          </div>
        )}
      </div>
    </Modal>
  );
}
