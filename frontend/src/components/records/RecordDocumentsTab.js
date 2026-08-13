'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useToast } from '../ui/Toast.js';
import { usePermissions } from '../../hooks/usePermissions.js';
import { getApiError } from '../../lib/api.js';
import * as documentsApi from '../../lib/services/documents.js';
import { ArrowDownTrayIcon, TrashIcon, PaperClipIcon } from '@heroicons/react/24/outline';
import RecordDetailLink from './RecordDetailLink.js';
import { tableLinkClass } from '../../lib/tableStyles.js';

export default function RecordDocumentsTab({ relatedType, recordId, canEdit = false }) {
  const { showToast } = useToast();
  const { can } = usePermissions();
  // Global documents.upload (managers) OR owner/editor of this record (e.g. contact owner).
  const canUpload = can('documents', 'upload') || canEdit;
  const canDownload = can('documents', 'download') || can('documents', 'view');
  const canDelete = can('documents', 'delete');
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const fileInputRef = useRef(null);

  const loadDocs = useCallback(async () => {
    if (!relatedType || !recordId) return;
    setLoading(true);
    try {
      setDocs(await documentsApi.listDocumentsForRecord(relatedType, recordId));
    } catch {
      setDocs([]);
    } finally {
      setLoading(false);
    }
  }, [relatedType, recordId]);

  useEffect(() => { loadDocs(); }, [loadDocs]);

  const handleFiles = async (fileList) => {
    const files = Array.from(fileList || []).filter(Boolean);
    if (!files.length) return;
    setUploading(true);
    let uploaded = 0;
    try {
      for (const file of files) {
        await documentsApi.uploadDocument({
          file,
          name: file.name,
          related_type: relatedType,
          related_id: recordId,
        });
        uploaded += 1;
      }
      await loadDocs();
      showToast(uploaded === 1 ? 'File uploaded' : `${uploaded} files uploaded`, 'success');
    } catch (err) {
      showToast(getApiError(err));
      if (uploaded) await loadDocs();
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDownload = async (doc) => {
    try {
      await documentsApi.downloadDocument(doc.id, doc.file_name || doc.name);
    } catch (err) {
      showToast(getApiError(err));
    }
  };

  const handleDelete = async (doc) => {
    setDeletingId(doc.id);
    try {
      await documentsApi.deleteDocument(doc.id);
      setDocs((prev) => prev.filter((item) => item.id !== doc.id));
      showToast('File removed', 'success');
    } catch (err) {
      showToast(getApiError(err));
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between gap-3 mb-4">
        <p className="text-sm text-zoho-muted">
          Attach PDF, CSV, PPT, Word, images, and other files to this record.
        </p>
        {canUpload && (
          <>
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              multiple
              accept={documentsApi.DOCUMENT_FILE_ACCEPT}
              onChange={(e) => handleFiles(e.target.files)}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="btn-primary text-xs shrink-0"
            >
              {uploading ? 'Uploading…' : 'Upload file'}
            </button>
          </>
        )}
      </div>

      {loading ? (
        <p className="text-sm text-zoho-muted">Loading files…</p>
      ) : docs.length === 0 ? (
        <p className="text-sm text-zoho-muted">No files attached yet</p>
      ) : (
        <div className="divide-y divide-zoho-border border border-zoho-border/60 rounded-xl overflow-hidden">
          {docs.map((doc) => (
            <div key={doc.id} className="flex items-center gap-3 px-3 py-2.5 bg-white hover:bg-brand-50/40">
              <PaperClipIcon className="w-4 h-4 text-zoho-muted shrink-0" />
              <div className="min-w-0 flex-1">
                <RecordDetailLink href={`/documents/${doc.id}`} className={`text-sm font-medium ${tableLinkClass}`}>
                  {doc.name || doc.document_name || 'Untitled'}
                </RecordDetailLink>
                <p className="text-[11px] text-zoho-muted mt-0.5">
                  {[doc.file_type || doc.mime_type, documentsApi.formatFileSize(doc.file_size)]
                    .filter((part) => part && part !== '—')
                    .join(' · ') || 'File'}
                  {doc.created_at ? ` · ${new Date(doc.created_at).toLocaleString()}` : ''}
                </p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {canDownload && (
                  <button
                    type="button"
                    onClick={() => handleDownload(doc)}
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
                    onClick={() => handleDelete(doc)}
                    disabled={deletingId === doc.id}
                    className="p-1.5 text-zoho-muted hover:text-red-600 rounded"
                    aria-label="Delete file"
                    title="Delete"
                  >
                    <TrashIcon className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
