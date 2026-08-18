'use client';
import { useState } from 'react';
import { ArrowDownTrayIcon, EyeIcon, TrashIcon } from '@heroicons/react/24/outline';
import { getApiError } from '../../lib/api.js';
import * as documentsApi from '../../lib/services/documents.js';
import DocumentPreviewModal from './DocumentPreviewModal.js';
import { tableLinkClass } from '../../lib/tableStyles.js';

export default function DocumentFileActions({
  doc,
  canDownload = true,
  canDelete = false,
  onDeleted,
  showToast,
  deleting = false,
  onDeleteStart,
}) {
  const [previewDoc, setPreviewDoc] = useState(null);

  const fileName = documentsApi.documentFileName(doc);

  const handleDownload = async () => {
    try {
      await documentsApi.downloadDocument(doc.id, fileName);
    } catch (err) {
      showToast?.(getApiError(err) || 'Could not download file');
    }
  };

  const handleDelete = async () => {
    onDeleteStart?.(doc.id);
    try {
      await documentsApi.deleteDocument(doc.id);
      onDeleted?.(doc.id);
      showToast?.('File removed', 'success');
    } catch (err) {
      showToast?.(getApiError(err));
    }
  };

  return (
    <>
      <div className="flex items-center gap-1 shrink-0">
        <button
          type="button"
          onClick={() => setPreviewDoc(doc)}
          className="p-1.5 text-zoho-muted hover:text-brand-600 rounded"
          aria-label="Preview file"
          title="Preview"
        >
          <EyeIcon className="w-4 h-4" />
        </button>
        {canDownload && (
          <button
            type="button"
            onClick={handleDownload}
            className="p-1.5 text-zoho-muted hover:text-brand-600 rounded"
            aria-label="Download file"
            title="Download"
          >
            <ArrowDownTrayIcon className="w-4 h-4" />
          </button>
        )}
        {canDelete && (
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleting}
            className="p-1.5 text-zoho-muted hover:text-red-600 rounded"
            aria-label="Delete file"
            title="Delete"
          >
            <TrashIcon className="w-4 h-4" />
          </button>
        )}
      </div>

      {previewDoc && (
        <DocumentPreviewModal doc={previewDoc} onClose={() => setPreviewDoc(null)} />
      )}
    </>
  );
}

export function DocumentFileNameButton({ doc, opening = false, onOpen, className = '' }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      disabled={opening}
      className={`text-sm font-medium text-left truncate ${tableLinkClass} ${className}`}
      title="Open file"
    >
      {opening ? 'Opening…' : documentsApi.documentFileName(doc)}
    </button>
  );
}
