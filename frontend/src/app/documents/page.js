'use client';
import { useEffect, useState, useCallback } from 'react';
import CRMLayout from '../../components/layout/CRMLayout.js';
import ConfirmDialog from '../../components/ui/ConfirmDialog.js';
import { useToast } from '../../components/ui/Toast.js';
import ApiPendingBanner from '../../components/ui/ApiPendingBanner.js';

export default function DocumentsPage() {
  const { showToast } = useToast();
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [deleteTarget, setDeleteTarget] = useState(null);

  const fetch = useCallback(() => {
    setLoading(false);
    setDocs([]);
  }, []);

  useEffect(() => { fetch(); }, [fetch, search]);

  const upload = async (e) => {
    const file = e.target.files?.[0];
    if (!file || file.size > 10 * 1024 * 1024) { showToast('File must be under 10 MB'); return; }
    showToast('Documents is not available on the Sales CRM API yet');
  };

  return (
    <CRMLayout>
      <div className="p-6">
        <ApiPendingBanner module="Documents" />
        <div className="flex justify-between mb-5">
          <h1 className="text-xl font-bold">Documents</h1>
          <label className="btn-primary cursor-pointer">+ Upload<input type="file" className="hidden" accept=".pdf,.docx,.xlsx,.jpg,.jpeg,.png" onChange={upload} /></label>
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
        onConfirm={() => { setDeleteTarget(null); showToast('Documents is not available on the Sales CRM API yet'); }} onCancel={() => setDeleteTarget(null)} />
    </CRMLayout>
  );
}
