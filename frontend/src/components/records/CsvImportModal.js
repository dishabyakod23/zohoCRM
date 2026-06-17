'use client';
import { useEffect, useMemo, useState } from 'react';
import Modal from '../ui/Modal.js';
import { useToast } from '../ui/Toast.js';
import { getApiError } from '../../lib/api.js';
import { getImportFields } from '../../lib/importFieldConfig.js';
import {
  parseCsvFile,
  suggestColumnMapping,
  columnPreviewValues,
  applyColumnMapping,
  mappedRowsToCsvFile,
  getMappedFieldKeys,
  validateMapping,
} from '../../lib/csvHelpers.js';

const STEPS = { upload: 'upload', mapping: 'mapping', preview: 'preview' };

export default function CsvImportModal({
  open,
  onClose,
  title = 'Upload CSV',
  module = 'leads',
  importFn,
  downloadTemplate,
  onDone,
}) {
  const { showToast } = useToast();
  const fieldDefs = useMemo(() => getImportFields(module), [module]);

  const [step, setStep] = useState(STEPS.upload);
  const [file, setFile] = useState(null);
  const [headers, setHeaders] = useState([]);
  const [rows, setRows] = useState([]);
  const [mapping, setMapping] = useState({});
  const [hideRecognized, setHideRecognized] = useState(false);
  const [preview, setPreview] = useState(null);
  const [validating, setValidating] = useState(false);
  const [importing, setImporting] = useState(false);

  const reset = () => {
    setStep(STEPS.upload);
    setFile(null);
    setHeaders([]);
    setRows([]);
    setMapping({});
    setHideRecognized(false);
    setPreview(null);
  };

  useEffect(() => {
    if (!open) reset();
  }, [open]);

  const recognizedCount = useMemo(
    () => headers.filter((h) => mapping[h]).length,
    [headers, mapping],
  );

  const visibleHeaders = useMemo(
    () => (hideRecognized ? headers.filter((h) => !mapping[h]) : headers),
    [headers, mapping, hideRecognized],
  );

  const buildMappedFile = () => {
    const mappedRows = applyColumnMapping(rows, mapping);
    const fieldKeys = getMappedFieldKeys(mapping);
    return mappedRowsToCsvFile(mappedRows, fieldKeys, file?.name || 'import.csv');
  };

  const handleFile = async (e) => {
    const next = e.target.files?.[0];
    if (!next) return;
    if (next.size > 5 * 1024 * 1024) {
      showToast('File must be under 5 MB');
      return;
    }
    try {
      const parsed = await parseCsvFile(next);
      if (!parsed.headers.length) {
        showToast('CSV file has no column headers');
        return;
      }
      setFile(next);
      setHeaders(parsed.headers);
      setRows(parsed.rows);
      setMapping(suggestColumnMapping(parsed.headers, fieldDefs));
      setPreview(null);
      setStep(STEPS.mapping);
    } catch {
      showToast('Could not read CSV file');
    }
  };

  const handleValidate = async () => {
    const mapErr = validateMapping(mapping, fieldDefs);
    if (mapErr) {
      showToast(mapErr);
      return;
    }
    setValidating(true);
    try {
      const mappedFile = buildMappedFile();
      const result = await importFn(mappedFile, { dry_run: true });
      setPreview(result);
      if (!result.ready_count) showToast('No valid rows found after mapping');
    } catch (err) {
      showToast(getApiError(err));
    } finally {
      setValidating(false);
    }
  };

  const handleImport = async () => {
    const mapErr = validateMapping(mapping, fieldDefs);
    if (mapErr) {
      showToast(mapErr);
      return;
    }
    setImporting(true);
    try {
      const mappedFile = buildMappedFile();
      let readyCount = preview?.ready_count;
      if (!readyCount) {
        const dryResult = await importFn(mappedFile, { dry_run: true });
        setPreview(dryResult);
        readyCount = dryResult.ready_count;
        if (!readyCount) {
          showToast('No valid rows found after mapping');
          return;
        }
      }
      const result = await importFn(mappedFile, { dry_run: false });
      showToast(`Imported ${result.imported_count ?? result.ready_count ?? readyCount} record(s)`, 'success');
      onDone?.();
      onClose();
    } catch (err) {
      showToast(getApiError(err));
    } finally {
      setImporting(false);
    }
  };

  if (!open) return null;

  return (
    <Modal title={title} onClose={onClose} wide>
      {step === STEPS.upload && (
        <div className="space-y-4">
          <p className="text-sm text-zoho-muted">
            Upload a CSV file. On the next step you can map each column to the correct CRM field.
          </p>
          {downloadTemplate && (
            <button type="button" onClick={downloadTemplate} className="text-xs text-brand-600 hover:underline">
              Download CSV template
            </button>
          )}
          <input type="file" accept=".csv" onChange={handleFile} className="text-sm w-full" />
        </div>
      )}

      {step === STEPS.mapping && (
        <div className="space-y-4">
          <p className="text-sm text-zoho-muted">
            We mapped fields we recognized automatically. For any that look wrong, choose the correct CRM field from the dropdown.
          </p>

          <div className="flex flex-wrap items-center gap-3 text-xs">
            <span className="font-medium text-zoho-text">
              {headers.length} column{headers.length === 1 ? '' : 's'} detected:
            </span>
            <span className="inline-flex items-center gap-1 text-green-700">
              <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
              {recognizedCount} recognized
            </span>
            <label className="inline-flex items-center gap-1.5 ml-auto cursor-pointer">
              <input
                type="checkbox"
                checked={hideRecognized}
                onChange={(e) => setHideRecognized(e.target.checked)}
                className="rounded border-zoho-border"
              />
              Hide recognized columns
            </label>
          </div>

          <div className="overflow-x-auto pb-2 -mx-1 px-1">
            <div className="flex gap-3 min-w-max">
              {visibleHeaders.map((header) => {
                const mapped = mapping[header];
                const samples = columnPreviewValues(rows, header);
                return (
                  <div key={header} className="w-52 shrink-0 border border-zoho-border rounded-lg bg-gray-50/80 p-3">
                    <div className="flex items-start gap-1.5 mb-2">
                      {mapped ? (
                        <svg className="w-4 h-4 text-green-600 shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
                      ) : (
                        <span className="w-4 h-4 shrink-0 mt-0.5 rounded-full border border-amber-400 bg-amber-50" />
                      )}
                      <p className="text-xs font-semibold text-zoho-text break-all" title={header}>{header}</p>
                    </div>
                    <select
                      className="input text-xs py-1.5 mb-2"
                      value={mapped || ''}
                      onChange={(e) => {
                        setPreview(null);
                        setMapping((m) => ({ ...m, [header]: e.target.value }));
                      }}
                    >
                      <option value="">— Do not import —</option>
                      {fieldDefs.map((f) => (
                        <option key={f.key} value={f.key}>
                          {f.label}{f.required ? ' *' : ''}
                        </option>
                      ))}
                    </select>
                    <div className="space-y-1">
                      {samples.length ? samples.map((s) => (
                        <p key={s} className="text-[11px] text-zoho-muted truncate" title={s}>{s}</p>
                      )) : (
                        <p className="text-[11px] text-zoho-muted italic">No sample data</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {preview && (
            <div className="text-xs space-y-1 border-t border-zoho-border pt-3">
              <p className="text-green-700">{preview.ready_count} row(s) ready to import</p>
              {preview.error_count > 0 && (
                <>
                  <p className="text-red-600">{preview.error_count} error(s)</p>
                  {preview.errorRecords?.length > 0 && (
                    <div className="max-h-24 overflow-y-auto bg-red-50 p-2 rounded">
                      {preview.errorRecords.slice(0, 8).map((e, i) => (
                        <p key={i}>Row {e.row}: {e.error}</p>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-zoho-border pt-4">
            <div className="flex items-center gap-2 text-xs text-zoho-muted min-w-0">
              <span className="truncate max-w-[200px]" title={file?.name}>{file?.name}</span>
              <button type="button" onClick={reset} className="text-red-500 hover:underline shrink-0">Remove</button>
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={onClose} className="btn-secondary text-xs">Cancel</button>
              <button type="button" onClick={handleValidate} disabled={validating} className="btn-secondary text-xs">
                {validating ? 'Validating…' : 'Validate mapping'}
              </button>
              <button
                type="button"
                onClick={handleImport}
                disabled={importing}
                className="btn-primary text-xs"
              >
                {importing ? 'Importing…' : 'Import'}
              </button>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}
