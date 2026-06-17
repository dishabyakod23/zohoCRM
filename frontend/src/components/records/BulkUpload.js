'use client';
import { useState } from 'react';
import Modal from '../ui/Modal.js';
import { useToast } from '../ui/Toast.js';
import { getApiError } from '../../lib/api.js';
import * as contactsApi from '../../lib/services/contacts.js';

export default function BulkUpload({ onDone }) {
  const { showToast } = useToast();
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [validating, setValidating] = useState(false);
  const [importing, setImporting] = useState(false);

  const handleFile = (e) => {
    const next = e.target.files?.[0];
    if (!next || next.size > 5 * 1024 * 1024) {
      showToast('File must be under 5 MB');
      return;
    }
    setFile(next);
    setPreview(null);
  };

  const validate = async () => {
    if (!file) { showToast('Choose a CSV file first'); return; }
    setValidating(true);
    try {
      const result = await contactsApi.importContactsFile(file, { dry_run: true });
      setPreview(result);
      if (result.ready_count === 0) showToast('No valid rows found in file');
    } catch (err) {
      showToast(getApiError(err));
    } finally {
      setValidating(false);
    }
  };

  const importRecords = async () => {
    if (!file) return;
    setImporting(true);
    try {
      const result = await contactsApi.importContactsFile(file, { dry_run: false });
      showToast(`Imported ${result.imported_count ?? result.ready_count ?? 0} contact(s)`, 'success');
      setOpen(false);
      setFile(null);
      setPreview(null);
      onDone?.();
    } catch (err) {
      showToast(getApiError(err));
    } finally {
      setImporting(false);
    }
  };

  const downloadTemplate = async () => {
    try {
      await contactsApi.downloadContactImportTemplate();
    } catch (err) {
      showToast(getApiError(err));
    }
  };

  return (
    <>
      <button onClick={() => setOpen(true)} className="btn-secondary">Bulk Upload</button>
      {open && (
        <Modal title="Bulk Upload Contacts" onClose={() => setOpen(false)}>
          <div className="space-y-3">
            <button type="button" onClick={downloadTemplate} className="text-xs text-brand-600 hover:underline">Download CSV template</button>
            <input type="file" accept=".csv" onChange={handleFile} className="text-sm" />
            {file && !preview && (
              <button type="button" onClick={validate} disabled={validating} className="btn-primary w-full">
                {validating ? 'Validating...' : 'Validate file'}
              </button>
            )}
            {preview && (
              <div className="text-sm space-y-2">
                <p className="text-green-700">{preview.ready_count} record(s) ready</p>
                <p className="text-red-600">{preview.error_count} error(s) found</p>
                {preview.errorRecords?.length > 0 && (
                  <div className="max-h-32 overflow-y-auto text-xs bg-red-50 p-2 rounded">
                    {preview.errorRecords.map((e, i) => <p key={i}>Row {e.row}: {e.error}</p>)}
                  </div>
                )}
                {preview.ready_count > 0 && (
                  <button type="button" onClick={importRecords} disabled={importing} className="btn-primary w-full">
                    {importing ? 'Importing...' : `Import ${preview.ready_count} record(s)`}
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
