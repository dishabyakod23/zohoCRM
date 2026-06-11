'use client';
import { useEffect, useState } from 'react';
import CRMLayout from '../../components/layout/CRMLayout.js';
import ConfirmDialog from '../../components/ui/ConfirmDialog.js';
import { useToast } from '../../components/ui/Toast.js';
import api from '../../lib/api.js';

export default function DocumentsPage() {
  const { showToast } = useToast();
  const [docs, setDocs] = useState([]);
  const [search, setSearch] = useState('');
  const [deleteTarget, setDeleteTarget] = useState(null);

  const fetch = () => api.get('/documents', { params: { search } }).then(r => setDocs(r.data.data));
  useEffect(() => { fetch(); }, [search]);

  const upload = async (e) => {
    const file = e.target.files?.[0];
    if (!file || file.size > 10 * 1024 * 1024) { showToast('File must be under 10 MB'); return; }
    const fd = new FormData();
    fd.append('file', file);
    fd.append('name', file.name);
    await api.post('/documents', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
    fetch(); showToast('Document uploaded', 'success');
  };

  return (
    <CRMLayout>
      <div className="p-6">
        <div className="flex justify-between mb-5">
          <h1 className="text-xl font-bold">Documents</h1>
          <label className="btn-primary cursor-pointer">+ Upload<input type="file" className="hidden" accept=".pdf,.docx,.xlsx,.jpg,.jpeg,.png" onChange={upload} /></label>
        </div>
        <div className="card">
          <div className="p-4 border-b"><input className="input max-w-xs" placeholder="Search documents..." value={search} onChange={e => setSearch(e.target.value)} /></div>
          <table className="w-full"><thead className="bg-gray-50"><tr><th className="table-th">Name</th><th className="table-th">Type</th><th className="table-th">Size</th><th className="table-th">Owner</th><th className="table-th">Actions</th></tr></thead>
            <tbody className="divide-y">{docs.map(d => (
              <tr key={d.id} className="hover:bg-gray-50">
                <td className="table-td font-medium">{d.name}</td>
                <td className="table-td">{d.file_type || '—'}</td>
                <td className="table-td">{(d.file_size / 1024).toFixed(1)} KB</td>
                <td className="table-td">{d.owner_name}</td>
                <td className="table-td flex gap-2">
                  <a href={`/api/documents/${d.id}/download`} className="text-xs text-blue-600">Download</a>
                  <button onClick={() => setDeleteTarget(d)} className="text-xs text-red-500">Remove</button>
                </td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </div>
      <ConfirmDialog open={!!deleteTarget} message={`Remove ${deleteTarget?.name} from this record?`} confirmLabel="Remove" danger
        onConfirm={async () => { await api.delete(`/documents/${deleteTarget.id}`); setDeleteTarget(null); fetch(); }} onCancel={() => setDeleteTarget(null)} />
    </CRMLayout>
  );
}
