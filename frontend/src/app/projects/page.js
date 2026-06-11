'use client';
import { useEffect, useState } from 'react';
import CRMLayout from '../../components/layout/CRMLayout.js';
import Modal from '../../components/ui/Modal.js';
import ConfirmDialog from '../../components/ui/ConfirmDialog.js';
import Badge from '../../components/ui/Badge.js';
import { useToast } from '../../components/ui/Toast.js';
import api from '../../lib/api.js';

export default function ProjectsPage() {
  const { showToast } = useToast();
  const [items, setItems] = useState([]);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ name: '', status: 'In Progress', start_date: '', end_date: '', description: '' });
  const [deleteTarget, setDeleteTarget] = useState(null);

  const fetch = () => api.get('/projects').then(r => setItems(r.data.data));
  useEffect(() => { fetch(); }, []);

  return (
    <CRMLayout>
      <div className="p-6">
        <div className="flex justify-between mb-5"><h1 className="text-xl font-bold">Projects</h1><button onClick={() => setModal(true)} className="btn-primary">+ Create Project</button></div>
        <div className="card overflow-x-auto">
          <table className="w-full"><thead className="bg-gray-50"><tr><th className="table-th">Name</th><th className="table-th">Account</th><th className="table-th">Status</th><th className="table-th">Dates</th><th className="table-th">Actions</th></tr></thead>
            <tbody className="divide-y">{items.map(p => (
              <tr key={p.id}><td className="table-td font-medium">{p.name}</td><td className="table-td">{p.account_name || '—'}</td>
                <td className="table-td"><Badge label={p.status} /></td><td className="table-td text-xs">{p.start_date || '—'} → {p.end_date || '—'}</td>
                <td className="table-td"><button onClick={() => setDeleteTarget(p)} className="text-xs text-red-500">🗑</button></td></tr>
            ))}</tbody>
          </table>
        </div>
      </div>
      {modal && <Modal title="Create Project" onClose={() => setModal(false)}>
        <div className="space-y-3">
          <input className="input" placeholder="Project name *" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
          <select className="input" value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value }))}>
            <option>In Progress</option><option>Completed</option><option>On Hold</option><option>Cancelled</option>
          </select>
          <textarea className="input" placeholder="Description" value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} />
        </div>
        <div className="flex gap-2 justify-end mt-4"><button onClick={() => setModal(false)} className="btn-secondary">Cancel</button>
          <button onClick={async () => { await api.post('/projects', form); setModal(false); fetch(); showToast('Project created', 'success'); }} className="btn-primary">Save</button></div>
      </Modal>}
      <ConfirmDialog open={!!deleteTarget} message={`Delete project "${deleteTarget?.name}"?`} confirmLabel="Confirm Delete" danger
        onConfirm={async () => { await api.delete(`/projects/${deleteTarget.id}`); setDeleteTarget(null); fetch(); }} onCancel={() => setDeleteTarget(null)} />
    </CRMLayout>
  );
}
