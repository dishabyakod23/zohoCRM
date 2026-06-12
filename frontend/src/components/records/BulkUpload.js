'use client';
import { useState } from 'react';
import Modal from '../ui/Modal.js';
import { useToast } from '../ui/Toast.js';

export default function BulkUpload({ endpoint, onDone, templateHeaders }) {
  const { showToast } = useToast();
  const [open, setOpen] = useState(false);
  const [csv, setCsv] = useState('');
  const [preview, setPreview] = useState(null);
  const [importing, setImporting] = useState(false);

  const handleFile = (e) => {
    const file = e.target.files?.[0];
    if (!file || file.size > 5 * 1024 * 1024) { showToast('File must be under 5 MB'); return; }
    const reader = new FileReader();
    reader.onload = (ev) => setCsv(ev.target.result);
    reader.readAsText(file);
  };

  const validate = async () => {
    showToast('Bulk upload is not available on the Sales CRM API yet');
  };

  const importRecords = async () => {
    setImporting(true);
    showToast('Bulk upload is not available on the Sales CRM API yet');
    setImporting(false);
  };

  const downloadTemplate = () => {
    const blob = new Blob([templateHeaders.join(',') + '\n'], { type: 'text/csv' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'template.csv'; a.click();
  };

  return (
    <>
      <button onClick={() => setOpen(true)} className="btn-secondary">Bulk Upload</button>
      {open && (
        <Modal title="Bulk Upload" onClose={() => setOpen(false)}>
          <div className="space-y-3">
            <button onClick={downloadTemplate} className="text-xs text-brand-600 hover:underline">Download CSV template</button>
            <input type="file" accept=".csv" onChange={handleFile} className="text-sm" />
            {csv && !preview && <button onClick={validate} className="btn-primary w-full">Validate file</button>}
            {preview && (
              <div className="text-sm space-y-2">
                <p className="text-green-700">{preview.ready} records ready</p>
                <p className="text-red-600">{preview.errors} errors found</p>
                {preview.errorRecords?.length > 0 && (
                  <div className="max-h-32 overflow-y-auto text-xs bg-red-50 p-2 rounded">
                    {preview.errorRecords.map((e, i) => <p key={i}>Row {e.row}: {e.error}</p>)}
                  </div>
                )}
                {preview.ready > 0 && (
                  <button onClick={importRecords} disabled={importing} className="btn-primary w-full">
                    {importing ? 'Importing...' : `Import ${preview.ready} records`}
                  </button>
                )}
              </div>
            )}
          </div>
        </Modal>
      )}
    </>
  );
}
