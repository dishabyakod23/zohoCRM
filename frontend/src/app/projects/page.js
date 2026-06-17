'use client';
import { useEffect, useState, useCallback, useMemo } from 'react';
import Link from 'next/link';
import CRMLayout from '../../components/layout/CRMLayout.js';
import Modal from '../../components/ui/Modal.js';
import Badge from '../../components/ui/Badge.js';
import RecordDataTable from '../../components/records/RecordDataTable.js';
import FormField, { inputClass } from '../../components/forms/FormField.js';
import { useToast } from '../../components/ui/Toast.js';
import { usePermissions } from '../../hooks/usePermissions.js';
import { getApiError } from '../../lib/api.js';
import { validateRequired } from '../../lib/validators.js';
import * as projectsApi from '../../lib/services/projects.js';
import { fetchAccountLookups, accountMapFromLookups, fetchProjectStatuses } from '../../lib/services/lookups.js';

const EMPTY = { name: '', account_id: '', status: 'planning', start_date: '', end_date: '', description: '' };

export default function ProjectsPage() {
  const { showToast } = useToast();
  const { canEdit } = usePermissions();
  const [items, setItems] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [statusOptions, setStatusOptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const accountMap = useMemo(() => accountMapFromLookups(accounts), [accounts]);

  useEffect(() => {
    Promise.all([fetchAccountLookups(), fetchProjectStatuses()])
      .then(([a, s]) => { setAccounts(a); setStatusOptions(s); })
      .catch(() => {});
  }, []);

  const openCreate = useCallback(() => { setForm(EMPTY); setErrors({}); setModal(true); }, []);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const result = await projectsApi.listProjects({ page: 1, page_size: 50 }, accountMap);
      setItems(result.data);
    } catch (err) {
      showToast(getApiError(err));
    } finally {
      setLoading(false);
    }
  }, [accountMap, showToast]);

  useEffect(() => { if (accounts.length) fetchItems(); }, [fetchItems, accounts.length]);

  const save = async () => {
    const errs = validateRequired({ name: 'Project Name', account_id: 'Account', start_date: 'Start Date' }, form);
    setErrors(errs);
    if (Object.keys(errs).length) { showToast('Please fill in all required fields.'); return; }
    setSaving(true);
    try {
      await projectsApi.createProject(form);
      setModal(false);
      fetchItems();
      showToast('Project saved', 'success');
    } catch (err) {
      showToast(getApiError(err));
    } finally {
      setSaving(false);
    }
  };

  const columns = useMemo(() => [
    { id: 'name', header: 'Name', cell: (p) => <Link href={`/projects/${p.id}`} className="font-medium text-brand-600 hover:underline">{p.name}</Link> },
    { id: 'account', header: 'Account', cell: (p) => p.account_name || '—' },
    { id: 'status', header: 'Status', cell: (p) => <Badge label={p.status_label} /> },
    { id: 'dates', header: 'Dates', cell: (p) => <span className="text-xs">{p.start_date || '—'} → {p.end_date || '—'}</span> },
  ], []);

  return (
    <CRMLayout>
      <div className="p-6">
        <div className="flex justify-between mb-5">
          <h1 className="text-xl font-bold">Projects</h1>
          {canEdit && <button onClick={openCreate} className="btn-primary">+ Create Project</button>}
        </div>
        <div className="card">
          <RecordDataTable
            moduleKey="projects"
            records={items}
            loading={loading}
            columns={columns}
            statusOptions={statusOptions}
            onRefresh={fetchItems}
            emptyMessage="No projects found"
          />
        </div>
      </div>
      {modal && <Modal title="Create Project" onClose={() => setModal(false)}>
        <div className="space-y-3">
          <FormField label="Project Name" required error={errors.name}><input className={inputClass(errors.name)} value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} /></FormField>
          <FormField label="Account" required error={errors.account_id}>
            <select className={inputClass(errors.account_id)} value={form.account_id} onChange={e => setForm(p => ({ ...p, account_id: e.target.value }))}>
              <option value="">Select</option>{accounts.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
            </select>
          </FormField>
          <FormField label="Status"><select className="input" value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value }))}>{statusOptions.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}</select></FormField>
          <FormField label="Start Date" required error={errors.start_date}><input className={inputClass(errors.start_date)} type="date" value={form.start_date?.slice(0, 10)} onChange={e => setForm(p => ({ ...p, start_date: e.target.value }))} /></FormField>
          <FormField label="End Date"><input className="input" type="date" value={form.end_date?.slice(0, 10)} onChange={e => setForm(p => ({ ...p, end_date: e.target.value }))} /></FormField>
          <FormField label="Description"><textarea className="input" value={form.description || ''} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} /></FormField>
        </div>
        <div className="flex gap-2 justify-end mt-4"><button onClick={() => setModal(false)} className="btn-secondary">Cancel</button><button onClick={save} disabled={saving} className="btn-primary">{saving ? 'Saving...' : 'Save'}</button></div>
      </Modal>}
    </CRMLayout>
  );
}
