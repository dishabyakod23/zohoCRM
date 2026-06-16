'use client';
import { useEffect, useState, useCallback, useMemo } from 'react';
import CRMLayout from '../../components/layout/CRMLayout.js';
import Modal from '../../components/ui/Modal.js';
import ConfirmDialog from '../../components/ui/ConfirmDialog.js';
import FormField, { inputClass } from '../../components/forms/FormField.js';
import { useToast } from '../../components/ui/Toast.js';
import { usePermissions } from '../../hooks/usePermissions.js';
import { useDebouncedValue } from '../../hooks/useDebouncedValue.js';
import { getApiError } from '../../lib/api.js';
import * as documentsApi from '../../lib/services/documents.js';
import { fetchAccountLookups } from '../../lib/services/lookups.js';

const ENTITY_TYPES = [
  { value: 'account', label: 'Account' },
  { value: 'lead', label: 'Lead' },
  { value: 'contact', label: 'Contact' },
  { value: 'deal', label: 'Deal' },
];

export default function DocumentsPage() {
  const { showToast } = useToast();
  const { canEdit, canDelete, canDownload } = usePermissions();
  const [docs, setDocs] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [uploadModal, setUploadModal] = useState(false);
  const [uploadForm, setUploadForm] = useState({ document_name: '', related_entity_type: 'account', related_entity_id: '', file: null });
  const [uploadErrors, setUploadErrors] = useState({});
  const [uploading, setUploading] = useState(false);

  useEffect(() => { fetchAccountLookups().then(setAccounts).catch(() => {}); }, []);

  const fetchDocs = useCallback(async () => {
    setLoading(true);
    try {
      const result = await documentsApi.listDocuments({ page: 1, page_size: 50, search: debouncedSearch || undefined });
      setDocs(result.data);
    } catch (err) {
      showToast(getApiError(err));
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, showToast]);

  useEffect(() => { fetchDocs(); }, [fetchDocs]);

  const defaultAccountId = useMemo(() => accounts[0]?.value || '', [accounts]);

  const openUpload = () => {
    setUploadForm({ document_name: '', related_entity_type: 'account', related_entity_id: defaultAccountId, file: null });
    setUploadErrors({});
    setUploadModal(true);
  };

  const handleUpload = async () => {
    const errs = {};
    if (!uploadForm.document_name) errs.document_name = 'Required';
    if (!uploadForm.related_entity_id) errs.related_entity_id = 'Select a related record';
    if (!uploadForm.file) errs.file = 'Select a file';
    setUploadErrors(errs);
    if (Object.keys(errs).length) return;

    setUploading(true);
    try {
      await documentsApi.uploadDocument(uploadForm);
      setUploadModal(false);
      fetchDocs();
      showToast('Document uploaded', 'success');
    } catch (err) {
      showToast(getApiError(err));
    } finally {
      setUploading(false);
    }
  };

  const handleDownload = async (doc) => {
    try {
      await documentsApi.downloadDocument(doc.id, doc.file_name || doc.name);
    } catch (err) {
      showToast(getApiError(err));
    }
  };

  const handleDelete = async () => {
    try {
      await documentsApi.deleteDocument(deleteTarget.id);
      setDeleteTarget(null);
      fetchDocs();
      showToast('Document removed', 'success');
    } catch (err) {
      showToast(getApiError(err));
    }
  };

  return (
    <CRMLayout>
      <div className="p-6">
        <div className="flex justify-between mb-5">
          <h1 className="text-xl font-bold">Documents</h1>
          {canEdit && <button onClick={openUpload} className="btn-primary">+ Upload</button>}
        </div>
        <div className="card">
          <div className="p-4 border-b"><input className="input max-w-xs" placeholder="Search documents..." value={search} onChange={e => setSearch(e.target.value)} /></div>
          <table className="w-full"><thead className="bg-gray-50"><tr><th className="table-th">Name</th><th className="table-th">Type</th><th className="table-th">Size</th><th className="table-th">Owner</th><th className="table-th">Actions</th></tr></thead>
            <tbody className="divide-y">
              {loading ? <tr><td colSpan={5} className="table-td text-center py-8">Loading...</td></tr>
              : docs.length === 0 ? <tr><td colSpan={5} className="table-td text-center py-8 text-gray-400">No documents found</td></tr>
              : docs.map(d => (
              <tr key={d.id} className="hover:bg-gray-50">
                <td className="table-td font-medium">{d.name}</td>
                <td className="table-td">{d.file_type || '—'}</td>
                <td className="table-td">{d.file_size ? `${(d.file_size / 1024).toFixed(1)} KB` : '—'}</td>
                <td className="table-td">{d.owner_name}</td>
                <td className="table-td">
                  {canDownload && <button type="button" onClick={() => handleDownload(d)} className="text-xs text-brand-600 hover:underline">Download</button>}
                  {canDelete && <button onClick={() => setDeleteTarget(d)} className="text-xs text-red-500 ml-2">Remove</button>}
                </td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </div>

      {uploadModal && (
        <Modal title="Upload Document" onClose={() => setUploadModal(false)}>
          <div className="space-y-3">
            <FormField label="Document Name" required error={uploadErrors.document_name}>
              <input className={inputClass(uploadErrors.document_name)} value={uploadForm.document_name} onChange={e => setUploadForm(f => ({ ...f, document_name: e.target.value }))} />
            </FormField>
            <FormField label="Related To">
              <select className="input" value={uploadForm.related_entity_type} onChange={e => setUploadForm(f => ({ ...f, related_entity_type: e.target.value, related_entity_id: e.target.value === 'account' ? defaultAccountId : '' }))}>
                {ENTITY_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </FormField>
            {uploadForm.related_entity_type === 'account' && (
              <FormField label="Account" required error={uploadErrors.related_entity_id}>
                <select className={inputClass(uploadErrors.related_entity_id)} value={uploadForm.related_entity_id} onChange={e => setUploadForm(f => ({ ...f, related_entity_id: e.target.value }))}>
                  <option value="">Select account</option>
                  {accounts.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
                </select>
              </FormField>
            )}
            {uploadForm.related_entity_type !== 'account' && (
              <FormField label="Record ID" required error={uploadErrors.related_entity_id}>
                <input className={inputClass(uploadErrors.related_entity_id)} placeholder="UUID of lead, contact, or deal" value={uploadForm.related_entity_id} onChange={e => setUploadForm(f => ({ ...f, related_entity_id: e.target.value }))} />
              </FormField>
            )}
            <FormField label="File" required error={uploadErrors.file}>
              <input type="file" className="input" accept=".pdf,.docx,.xlsx,.jpg,.jpeg,.png" onChange={e => setUploadForm(f => ({ ...f, file: e.target.files?.[0] || null, document_name: f.document_name || e.target.files?.[0]?.name || '' }))} />
            </FormField>
          </div>
          <div className="flex gap-2 justify-end mt-4">
            <button onClick={() => setUploadModal(false)} className="btn-secondary">Cancel</button>
            <button onClick={handleUpload} disabled={uploading} className="btn-primary">{uploading ? 'Uploading...' : 'Upload'}</button>
          </div>
        </Modal>
      )}

      <ConfirmDialog open={!!deleteTarget} message={`Remove ${deleteTarget?.name}?`} confirmLabel="Remove" danger onConfirm={handleDelete} onCancel={() => setDeleteTarget(null)} />
    </CRMLayout>
  );
}
