'use client';
import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import CRMLayout from '../../../components/layout/CRMLayout.js';
import ConfirmDialog from '../../../components/ui/ConfirmDialog.js';
import RecordDetailLayout, { FieldSection } from '../../../components/records/RecordDetailLayout.js';
import RecordDetailSkeleton from '../../../components/records/RecordDetailSkeleton.js';
import RelatedRecordCard from '../../../components/records/RelatedRecordCard.js';
import { useToast } from '../../../components/ui/Toast.js';
import { usePermissions } from '../../../hooks/usePermissions.js';
import { getApiError } from '../../../lib/api.js';
import { relatedRecordFromActivity } from '../../../lib/recordHelpers.js';
import * as documentsApi from '../../../lib/services/documents.js';
import { TrashIcon } from '@heroicons/react/24/outline';

export default function DocumentDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const { showToast } = useToast();
  const { canDelete, canDownload } = usePermissions();
  const [doc, setDoc] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  const load = useCallback(() => {
    documentsApi.getDocument(id).then(setDoc).catch(() => { showToast('Document not found'); router.push('/documents'); });
  }, [id, router, showToast]);

  useEffect(() => { load(); }, [load]);

  const handleDownload = async () => {
    try { await documentsApi.downloadDocument(id, doc.file_name || doc.name); }
    catch (err) { showToast(getApiError(err)); }
  };

  if (!doc) return <CRMLayout><RecordDetailSkeleton /></CRMLayout>;

  const related = doc.related_type && doc.related_id
    ? { type: doc.related_type, id: doc.related_id, label: doc.related_name || `${doc.related_type} #${doc.related_id}` }
    : relatedRecordFromActivity(doc);

  return (
    <CRMLayout>
      <RecordDetailLayout backHref="/documents" backLabel="Documents" title={doc.name || doc.document_name} subtitle={doc.file_type}
        recordNotes={{ relatedType: 'document', recordId: id, canEdit: true }}
        recordHistory={{ entityType: 'document', recordId: id }}
        actions={
          <>
            {canDownload && <button onClick={handleDownload} className="btn-secondary text-xs">Download</button>}
            {canDelete && <button onClick={() => setDeleteConfirm(true)} className="btn-danger text-xs flex items-center gap-1.5"><TrashIcon className="w-4 h-4" /> Delete</button>}
          </>
        }>
        <div className="space-y-4">
          {related && (
            <RelatedRecordCard relatedType={related.type} relatedId={related.id} label={related.label} />
          )}
          <FieldSection
            title="Document Details"
            fields={[
              ['Name', doc.name || doc.document_name],
              ['Folder', doc.folder],
              ['Type', doc.file_type || doc.mime_type],
              ['Size', doc.file_size ? `${(doc.file_size / 1024).toFixed(1)} KB` : null],
              ['Owner', doc.owner_name],
              ['Description', doc.description],
            ]}
          />
        </div>
      </RecordDetailLayout>
      <ConfirmDialog open={deleteConfirm} message={`Remove document "${doc.name}"?`} confirmLabel="Confirm Delete" danger
        onConfirm={async () => { try { await documentsApi.deleteDocument(id); router.push('/documents'); } catch (err) { showToast(getApiError(err)); } }}
        onCancel={() => setDeleteConfirm(false)} />
    </CRMLayout>
  );
}
