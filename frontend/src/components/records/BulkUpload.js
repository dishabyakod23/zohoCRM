'use client';
import { useState } from 'react';
import { useToast } from '../ui/Toast.js';
import { getApiError } from '../../lib/api.js';
import * as contactsApi from '../../lib/services/contacts.js';
import CsvImportModal from './CsvImportModal.js';

export default function BulkUpload({ onDone }) {
  const { showToast } = useToast();
  const [open, setOpen] = useState(false);

  const downloadTemplate = async () => {
    try {
      await contactsApi.downloadContactImportTemplate();
    } catch (err) {
      showToast(getApiError(err));
    }
  };

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="btn-secondary-sm">Bulk Upload</button>
      <CsvImportModal
        open={open}
        onClose={() => setOpen(false)}
        title="Import CSV — Contacts"
        module="contacts"
        importFn={contactsApi.importContactsFile}
        downloadTemplate={downloadTemplate}
        onDone={onDone}
      />
    </>
  );
}
