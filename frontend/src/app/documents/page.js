'use client';
import { useEffect, useState, useCallback, useMemo } from 'react';
import Link from 'next/link';
import CRMLayout from '../../components/layout/CRMLayout.js';
import ListPageHeader from '../../components/layout/ListPageHeader.js';
import ListSearchBar from '../../components/layout/ListSearchBar.js';
import Modal from '../../components/ui/Modal.js';
import RecordDataTable from '../../components/records/RecordDataTable.js';
import FormField, { inputClass } from '../../components/forms/FormField.js';
import { useToast } from '../../components/ui/Toast.js';
import { usePermissions } from '../../hooks/usePermissions.js';
import { useDebouncedValue } from '../../hooks/useDebouncedValue.js';
import { getApiError } from '../../lib/api.js';
import * as documentsApi from '../../lib/services/documents.js';
import * as leadsApi from '../../lib/services/leads.js';
import * as contactsApi from '../../lib/services/contacts.js';
import * as dealsApi from '../../lib/services/deals.js';
import { fetchAccountLookups, accountMapFromLookups } from '../../lib/services/lookups.js';
import { tableLinkClass } from '../../lib/tableStyles.js';

const ENTITY_TYPES = [
  { value: 'account', label: 'Account' },
  { value: 'lead', label: 'Lead' },
  { value: 'contact', label: 'Contact' },
  { value: 'deal', label: 'Deal' },
];

export default function DocumentsPage() {
  const { showToast } = useToast();
  const { canEdit } = usePermissions();
  const [docs, setDocs] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [entityOptions, setEntityOptions] = useState([]);
  const [loadingEntities, setLoadingEntities] = useState(false);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search);
  const [page, setPage] = useState(1);
  const [limit] = useState(15);
  const [uploadModal, setUploadModal] = useState(false);
  const [uploadForm, setUploadForm] = useState({ document_name: '', related_entity_type: 'account', related_entity_id: '', file: null });
  const [uploadErrors, setUploadErrors] = useState({});
  const [uploading, setUploading] = useState(false);

  const accountMap = useMemo(() => accountMapFromLookups(accounts), [accounts]);

  useEffect(() => { fetchAccountLookups().then(setAccounts).catch(() => {}); }, []);

  const fetchDocs = useCallback(async () => {
    setLoading(true);
    try {
      const result = await documentsApi.listDocuments({
        page,
        page_size: limit,
        search: debouncedSearch || undefined,
      });
      setDocs(result.data);
      setTotal(result.total ?? result.data.length);
    } catch (err) {
      showToast(getApiError(err));
    } finally {
      setLoading(false);
    }
  }, [page, limit, debouncedSearch, showToast]);

  useEffect(() => { fetchDocs(); }, [fetchDocs]);

  const defaultAccountId = useMemo(() => accounts[0]?.value || '', [accounts]);
  const totalPages = Math.ceil(total / limit) || 1;

  useEffect(() => {
    if (!uploadModal) return undefined;
    let cancelled = false;
    setLoadingEntities(true);
    setEntityOptions([]);

    const load = async () => {
      try {
        let options = [];
        if (uploadForm.related_entity_type === 'account') {
          options = accounts.map((a) => ({ value: a.value, label: a.label || a.name }));
        } else if (uploadForm.related_entity_type === 'lead') {
          const result = await leadsApi.listLeads({ page: 1, page_size: 100 });
          options = result.data.map((l) => ({
            value: l.id,
            label: `${l.first_name || ''} ${l.last_name || ''}`.trim() || l.company || l.id,
          }));
        } else if (uploadForm.related_entity_type === 'contact') {
          const result = await contactsApi.listContacts({ page: 1, page_size: 100 }, accountMap);
          options = result.data.map((c) => ({
            value: c.id,
            label: `${c.first_name || ''} ${c.last_name || ''}`.trim() || c.email || c.id,
          }));
        } else if (uploadForm.related_entity_type === 'deal') {
          const result = await dealsApi.listDeals({ page: 1, page_size: 100 }, accountMap);
          options = result.data.map((d) => ({
            value: d.id,
            label: d.name || d.deal_name || d.id,
          }));
        }
        if (!cancelled) setEntityOptions(options);
      } catch {
        if (!cancelled) setEntityOptions([]);
      } finally {
        if (!cancelled) setLoadingEntities(false);
      }
    };

    load();
    return () => { cancelled = true; };
  }, [uploadModal, uploadForm.related_entity_type, accounts, accountMap]);

  const openUpload = () => {
    setUploadForm({ document_name: '', related_entity_type: 'account', related_entity_id: defaultAccountId, file: null });
    setUploadErrors({});
    setUploadModal(true);
  };

  const onEntityTypeChange = (entityType) => {
    setUploadForm((f) => ({
      ...f,
      related_entity_type: entityType,
      related_entity_id: entityType === 'account' ? defaultAccountId : '',
    }));
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

  const columns = useMemo(() => [
    { id: 'name', header: 'Name', cell: (d) => <Link href={`/documents/${d.id}`} className={tableLinkClass}>{d.name}</Link> },
    { id: 'type', header: 'Type', cell: (d) => d.file_type || '—' },
    { id: 'size', header: 'Size', cell: (d) => d.file_size ? `${(d.file_size / 1024).toFixed(1)} KB` : '—' },
    { id: 'owner', header: 'Owner', cell: (d) => d.owner_name },
  ], []);

  return (
    <CRMLayout>
      <div className="p-6">
        <ListPageHeader
          title="Documents"
          subtitle="Files attached to accounts, leads, contacts, and deals."
          primaryAction={canEdit ? (
            <button type="button" onClick={openUpload} className="btn-primary-sm">Upload Document</button>
          ) : null}
        />

        <ListSearchBar
          search={search}
          onSearchChange={(v) => { setSearch(v); setPage(1); }}
          placeholder="Search documents…"
          total={total}
          totalLabel="documents"
          table={(
            <RecordDataTable
              moduleKey="documents"
              records={docs}
              loading={loading}
              columns={columns}
              onRefresh={fetchDocs}
              emptyMessage="No documents found"
              pagination={{
                page,
                totalPages,
                onPageChange: setPage,
                label: total ? `${((page - 1) * limit) + 1}–${Math.min(page * limit, total)} of ${total}` : '0 records',
              }}
            />
          )}
        />
      </div>

      {uploadModal && (
        <Modal title="Upload Document" onClose={() => setUploadModal(false)}>
          <div className="space-y-3">
            <FormField label="Document Name" required error={uploadErrors.document_name}>
              <input className={inputClass(uploadErrors.document_name)} value={uploadForm.document_name} onChange={e => setUploadForm(f => ({ ...f, document_name: e.target.value }))} />
            </FormField>
            <FormField label="Related To">
              <select className="input" value={uploadForm.related_entity_type} onChange={e => onEntityTypeChange(e.target.value)}>
                {ENTITY_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </FormField>
            <FormField label={`Related ${ENTITY_TYPES.find(t => t.value === uploadForm.related_entity_type)?.label || 'Record'}`} required error={uploadErrors.related_entity_id}>
              <select
                className={inputClass(uploadErrors.related_entity_id)}
                value={uploadForm.related_entity_id}
                onChange={e => setUploadForm(f => ({ ...f, related_entity_id: e.target.value }))}
                disabled={loadingEntities}
              >
                <option value="">{loadingEntities ? 'Loading records…' : 'Select record'}</option>
                {entityOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </FormField>
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
    </CRMLayout>
  );
}
