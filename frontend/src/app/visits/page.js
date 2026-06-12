'use client';
import { useEffect, useState, useCallback } from 'react';
import CRMLayout from '../../components/layout/CRMLayout.js';
import Modal from '../../components/ui/Modal.js';
import ConfirmDialog from '../../components/ui/ConfirmDialog.js';
import { useToast } from '../../components/ui/Toast.js';
import ApiPendingBanner from '../../components/ui/ApiPendingBanner.js';

export default function VisitsPage() {
  const { showToast } = useToast();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ title: '', visit_date: '', location: '', status: 'Planned' });
  const [deleteTarget, setDeleteTarget] = useState(null);

  const fetch = useCallback(() => {
    setLoading(false);
    setItems([]);
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  const save = () => {
    showToast('Visits is not available on the Sales CRM API yet');
  };

  return (
    <CRMLayout>
      <div className="p-6">
        <ApiPendingBanner module="Visits" />
        <div className="flex justify-between mb-5"><h1 className="text-xl font-bold">Visits</h1><button onClick={() => setModal(true)} className="btn-primary">+ Log Visit</button></div>
        <div className="card overflow-x-auto">
          <table className="w-full"><thead className="bg-gray-50"><tr><th className="table-th">Title</th><th className="table-th">Date</th><th className="table-th">Location</th><th className="table-th">Status</th><th className="table-th">Actions</th></tr></thead>
            <tbody className="divide-y">
              {loading ? <tr><td colSpan={5} className="table-td text-center py-8">Loading...</td></tr>
              : items.length === 0 ? <tr><td colSpan={5} className="table-td text-center py-8 text-gray-400">No visits found</td></tr>
              : items.map(v => (
              <tr key={v.id}><td className="table-td font-medium">{v.title}</td><td className="table-td">{new Date(v.visit_date).toLocaleString()}</td><td className="table-td">{v.location}</td><td className="table-td">{v.status}</td>
                <td className="table-td"><button onClick={() => setDeleteTarget(v)} className="text-xs text-red-500">🗑</button></td></tr>
            ))}</tbody>
          </table>
        </div>
      </div>
      {modal && <Modal title="Log Visit" onClose={() => setModal(false)}>
        <div className="space-y-3">
          <input className="input" placeholder="Title" value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} />
          <input className="input" type="datetime-local" value={form.visit_date?.slice(0,16)} onChange={e => setForm(p => ({ ...p, visit_date: e.target.value }))} />
          <input className="input" placeholder="Location" value={form.location} onChange={e => setForm(p => ({ ...p, location: e.target.value }))} />
        </div>
        <div className="flex gap-2 justify-end mt-4"><button onClick={() => setModal(false)} className="btn-secondary">Cancel</button>
          <button onClick={save} className="btn-primary">Save</button></div>
      </Modal>}
      <ConfirmDialog open={!!deleteTarget} message={`Delete visit "${deleteTarget?.title}"?`} confirmLabel="Confirm Delete" danger
        onConfirm={() => { setDeleteTarget(null); showToast('Visits is not available on the Sales CRM API yet'); }} onCancel={() => setDeleteTarget(null)} />
    </CRMLayout>
  );
}
