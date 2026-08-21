/** Normalize boolean-ish CSV values for import payloads. */
export function coerceImportBool(value) {
  if (value == null || value === '') return false;
  const v = String(value).trim().toLowerCase();
  return ['1', 'true', 'yes', 'y', 'on'].includes(v);
}

/** Trigger browser download from a blob API response */
export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

/** Use the human-readable part of API import messages (text before ";"). */
export function formatImportNotice(message) {
  if (!message) return '';
  const text = String(message).trim();
  const semi = text.indexOf(';');
  return (semi === -1 ? text : text.slice(0, semi)).trim();
}

function normalizeImportIssue(entry) {
  if (!entry) return null;
  if (typeof entry === 'string') {
    return { row: null, message: formatImportNotice(entry) };
  }
  return {
    row: entry.row ?? entry.row_number ?? entry.line ?? null,
    message: formatImportNotice(entry.message ?? entry.error ?? String(entry)),
  };
}

/** Build a toast-friendly message when import validation finds no importable rows. */
export function importValidationNotice(result = {}) {
  const warnings = (result.warnings || []).map(normalizeImportIssue).filter((w) => w?.message);
  const errors = (result.errorRecords || []).map(normalizeImportIssue).filter((e) => e?.message);

  const issues = warnings.length ? warnings : errors;
  if (!issues.length) return null;

  const uniqueMessages = [...new Set(issues.map((i) => i.message))];
  if (uniqueMessages.length === 1) {
    const count = issues.length;
    return count > 1 ? `${uniqueMessages[0]} (${count} rows)` : uniqueMessages[0];
  }

  return uniqueMessages.slice(0, 3).join(' · ');
}

/** Normalize POST /leads/import or /contacts/import response */
export function normalizeImportResult(data = {}) {
  const warningRecords = (data.warnings || []).map(normalizeImportIssue).filter(Boolean);
  const rawErrors = Array.isArray(data.errorRecords)
    ? data.errorRecords
    : Array.isArray(data.errors)
      ? data.errors
      : [];
  const errorRecords = rawErrors.map(normalizeImportIssue).filter(Boolean);

  return {
    dry_run: data.dry_run,
    total_rows: data.total_rows ?? 0,
    ready: data.ready_count ?? data.ready ?? 0,
    ready_count: data.ready_count ?? data.ready ?? 0,
    imported_count: data.imported_count ?? data.imported ?? 0,
    skipped_count: data.skipped_count ?? data.skipped ?? 0,
    errors: data.error_count ?? errorRecords.length ?? 0,
    error_count: data.error_count ?? errorRecords.length ?? 0,
    errorRecords,
    warnings: data.warnings || [],
    warning_count: data.skipped_count ?? data.skipped ?? warningRecords.length ?? 0,
    warningRecords,
    created_ids: data.created_ids || [],
    records: Array.isArray(data.records) ? data.records : [],
    skip_messages: data.skip_messages || [],
    readyRecords: data.readyRecords,
  };
}

/** Per-request timeout for bulk-upload / bulk-import (default axios timeout is 45s). */
export const BULK_IMPORT_TIMEOUT_MS = 180000;

/** Rows per POST /…/bulk-import request. */
export const BULK_IMPORT_CHUNK_SIZE = 200;

export function chunkArray(items = [], size = BULK_IMPORT_CHUNK_SIZE) {
  const list = Array.isArray(items) ? items : [];
  const chunkSize = Math.max(1, Number(size) || BULK_IMPORT_CHUNK_SIZE);
  if (!list.length) return [];
  const chunks = [];
  for (let i = 0; i < list.length; i += chunkSize) {
    chunks.push(list.slice(i, i + chunkSize));
  }
  return chunks;
}

/** Merge chunked bulk-import API payloads into one result. */
export function mergeBulkImportResults(results = []) {
  let imported = 0;
  let skipped = 0;
  let errors = 0;
  const records = [];
  const skip_messages = [];
  const errorRecords = [];
  const created_ids = [];

  for (const result of results) {
    const row = result || {};
    imported += Number(row.imported ?? row.imported_count ?? 0) || 0;
    skipped += Number(row.skipped ?? row.skipped_count ?? 0) || 0;
    errors += Number(row.errors ?? row.error_count ?? 0) || 0;

    if (Array.isArray(row.records)) records.push(...row.records);
    if (Array.isArray(row.skip_messages)) skip_messages.push(...row.skip_messages);
    if (Array.isArray(row.errorRecords)) errorRecords.push(...row.errorRecords);
    else if (Array.isArray(row.errors) && row.errors.length && typeof row.errors[0] === 'object') {
      errorRecords.push(...row.errors);
    }

    const ids = Array.isArray(row.created_ids)
      ? row.created_ids
      : (row.records || []).map((r) => r?.id).filter(Boolean);
    created_ids.push(...ids);
  }

  if (!imported && records.length) imported = records.length;

  return {
    imported,
    imported_count: imported,
    skipped,
    skipped_count: skipped,
    errors,
    error_count: errors || errorRecords.length,
    records,
    skip_messages,
    errorRecords,
    created_ids,
  };
}

/**
 * POST records to a bulk-import endpoint in chunks with an extended timeout.
 * Keeps campaign_id on every chunk when provided.
 */
export async function postBulkImportInChunks(
  apiClient,
  url,
  { records = [], campaign_id, chunkSize = BULK_IMPORT_CHUNK_SIZE, timeout = BULK_IMPORT_TIMEOUT_MS } = {},
) {
  const chunks = chunkArray(records, chunkSize);
  if (!chunks.length) {
    return mergeBulkImportResults([]);
  }

  const results = [];
  for (const chunk of chunks) {
    const body = { records: chunk };
    if (campaign_id) body.campaign_id = campaign_id;
    const res = await apiClient.post(url, body, { timeout });
    results.push(res.data?.data || res.data || {});
  }
  return mergeBulkImportResults(results);
}
