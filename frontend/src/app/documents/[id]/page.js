'use client';
import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import CRMLayout from '../../../components/layout/CRMLayout.js';
import ConfirmDialog from '../../../components/ui/ConfirmDialog.js';
import RecordDetailLayout from '../../../components/records/RecordDetailLayout.js';
import EditableFieldSection from '../../../components/records/EditableFieldSection.js';
import { useToast } from '../../../components/ui/Toast.js';
import { usePermissions } from '../../../hooks/usePermissions.js';
import { getApiError } from '../../../lib/api.js';
import * as documentsApi from '../../../lib/services/documents.js';
import { TrashIcon } from '@heroicons/react/24/outline';

export default function DocumentDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const { showToast } = useToast();
  const { canEdit, canDelete, canDownload } = usePermissions();
  const [doc, setDoc] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    documentsApi.getDocument(id).then(setDoc).catch(() => { showToast('Document not found'); router.push('/documents'); });
  }, [id, router, showToast]);

  useEffect(() => { load(); }, [load]);

  const saveSection = async (payload) => {
    setSaving(true);
    try {
      await documentsApi.updateDocument(id, payload);
      load();
      showToast('Document updated', 'success');
    } catch (err) { showToast(getApiError(err)); throw err; }
    finally { setSaving(false); }
  };

  const handleDownload = async () => {
    try { await documentsApi.downloadDocument(id, doc.file_name || doc.name); }
    catch (err) { showToast(getApiError(err)); }
  };

  if (!doc) return <CRMLayout><div className="p-6">Loading...</div></CRMLayout>;

  return (
    <CRMLayout>
      <RecordDetailLayout backHref="/documents" backLabel="Documents" title={doc.name} subtitle={doc.file_type}
        recordNotes={{ relatedType: 'document', recordId: id, canEdit }}
        actions={
          <>
            {canDownload && <button onClick={handleDownload} className="btn-secondary text-xs">Download</button>}
            {canDelete && <button onClick={() => setDeleteConfirm(true)} className="btn-danger text-xs flex items-center gap-1.5"><TrashIcon className="w-4 h-4" /> Delete</button>}
          </>
        }>
        <EditableFieldSection canEdit={canEdit} saving={saving} title="Document Details" values={doc} onSave={saveSection}
          fields={[
            { name: 'document_name', label: 'Name', format: () => doc.name },
            { name: 'folder', label: 'Folder' },
            { name: 'mime_type', label: 'Type', format: () => doc.file_type },
            { name: 'file_size', label: 'Size', format: (v) => (v ? `${(v / 1024).toFixed(1)} KB` : null) },
            { name: 'owner_name', label: 'Owner', format: () => doc.owner_name },
            { name: 'description', label: 'Description', colSpan: true, render: (d, set) => (
              <textarea className="input min-h-[80px]" value={d.description ?? ''} onChange={(e) => set((p) => ({ ...p, description: e.target.value }))} />
            ) },
          ]} />
      </RecordDetailLayout>
      <ConfirmDialog open={deleteConfirm} message={`Remove document "${doc.name}"?`} confirmLabel="Confirm Delete" danger
        onConfirm={async () => { try { await documentsApi.deleteDocument(id); router.push('/documents'); } catch (err) { showToast(getApiError(err)); } }}
        onCancel={() => setDeleteConfirm(false)} />
    </CRMLayout>
  );
}
