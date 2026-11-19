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
  const skipMessages = (result.skip_messages || [])
    .map((m) => (typeof m === 'string' ? formatImportNotice(m) : formatImportNotice(m?.message || m)))
    .filter(Boolean);

  const allMessages = [
    ...warnings.map((w) => w.message),
    ...errors.map((e) => e.message),
    ...skipMessages,
  ];

  const duplicateLike = allMessages.find((msg) => /duplicate|already exist|already exists|email.*exist/i.test(msg));
  if (duplicateLike || result.duplicate_count || result.duplicates) {
    return 'Some contacts already exist (duplicate email). Remove or update those rows and try again.';
  }

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
    partial: Boolean(data.partial),
  };
}

/** Per-request timeout for bulk-upload / bulk-import (default axios timeout is 45s). */
export const BULK_IMPORT_TIMEOUT_MS = 180000;

/**
 * Rows per POST /…/bulk-import request.
 * Kept well under the API/nginx failure threshold (~1000 rows) seen in production; the backend
 * accepts up to 10000. A failing batch is still split and retried (postBulkImportChunkWithSplit).
 */
export const BULK_IMPORT_CHUNK_SIZE = 200;

/** Follow-up PATCH requests after an import run this many at a time (never all at once). */
export const IMPORT_PATCH_CONCURRENCY = 5;

/** A CSV check from the preview step is reused for the import if it is at most this old. */
export const IMPORT_CHECK_REUSE_MS = 5 * 60 * 1000;

/**
 * The bulk-upload (CSV check) payload to import from: the one saved by an earlier check of the same
 * mapped file when it is recent, otherwise null (the caller then checks the file again).
 */
export function reusableUploadPayload(checked, { now = Date.now(), maxAgeMs = IMPORT_CHECK_REUSE_MS } = {}) {
  const payload = checked?.upload_payload;
  if (!payload || !Array.isArray(payload.readyRecords)) return null;
  const checkedAt = Number(checked.checked_at) || 0;
  if (!checkedAt || now - checkedAt > maxAgeMs) return null;
  return payload;
}

/** Run `worker` over `items` with at most `limit` running at once; resolves to allSettled results. */
export async function mapWithConcurrency(items = [], limit = IMPORT_PATCH_CONCURRENCY, worker) {
  const list = Array.isArray(items) ? items : [];
  const results = new Array(list.length);
  let next = 0;
  const run = async () => {
    while (next < list.length) {
      const index = next;
      next += 1;
      try {
        results[index] = { status: 'fulfilled', value: await worker(list[index], index) };
      } catch (reason) {
        results[index] = { status: 'rejected', reason };
      }
    }
  };
  const lanes = Math.max(1, Math.min(Number(limit) || 1, list.length));
  await Promise.all(Array.from({ length: lanes }, run));
  return results;
}

const isBlank = (value) => value == null || String(value).trim() === '';

/**
 * After bulk-import, PATCH only the CSV values the import did not save, a few requests at a time.
 * `extrasFor(record)` gives { field: value } from a processed CSV row. A field is patched when the
 * created row returned by the API has it empty, or — for fields in `patchWhenMissing` — does not
 * return it at all (e.g. industry, which the contact import does not save). Fields the import
 * saves itself (LinkedIn as skype_id) are therefore not sent again.
 * Returns { patched, failed } so the caller can tell the user.
 */
export async function patchImportedCsvExtras({
  created = [],
  processedRecords = [],
  extrasFor,
  patch,
  patchWhenMissing = [],
  concurrency = IMPORT_PATCH_CONCURRENCY,
  onProgress,
} = {}) {
  const rows = Array.isArray(created) ? created : [];
  if (!rows.length || !processedRecords?.length) return { patched: 0, failed: 0 };

  const byEmail = new Map();
  for (const record of processedRecords) {
    const email = String(record?.email || '').trim().toLowerCase();
    if (!email || byEmail.has(email)) continue;
    const extras = Object.fromEntries(Object.entries(extrasFor(record) || {}).filter(([, v]) => !isBlank(v)));
    if (Object.keys(extras).length) byEmail.set(email, extras);
  }
  if (!byEmail.size) return { patched: 0, failed: 0 };

  const jobs = [];
  for (const row of rows) {
    const email = String(row?.email || '').trim().toLowerCase();
    const extras = email ? byEmail.get(email) : null;
    if (!row?.id || !extras) continue;
    const payload = {};
    for (const [field, value] of Object.entries(extras)) {
      const returned = Object.prototype.hasOwnProperty.call(row, field);
      if (returned ? isBlank(row[field]) : patchWhenMissing.includes(field)) payload[field] = value;
    }
    if (Object.keys(payload).length) jobs.push({ id: row.id, payload });
  }
  if (!jobs.length) return { patched: 0, failed: 0 };

  let done = 0;
  const results = await mapWithConcurrency(jobs, concurrency, async (job) => {
    try {
      return await patch(job.id, job.payload);
    } finally {
      done += 1;
      if (done === jobs.length || done % 25 === 0) {
        onProgress?.({ phase: 'extras', current: done, total: jobs.length, message: `Saving extra details ${done} of ${jobs.length}…` });
      }
    }
  });
  const failed = results.filter((r) => r.status === 'rejected').length;
  return { patched: jobs.length - failed, failed };
}

/** Skip-message line for follow-up PATCHes that failed, or null. */
export function extrasFailureMessage(failed, noun = 'records') {
  if (!failed) return null;
  return `${failed} ${noun} were imported, but some details (industry or LinkedIn) could not be saved. Edit them on the record.`;
}

/** Smallest chunk size when auto-splitting after a server error (1 = isolate bad rows). */
export const BULK_IMPORT_MIN_CHUNK_SIZE = 1;

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

function bulkImportErrorMessage(err) {
  const data = err?.response?.data;
  if (typeof data === 'string' && data.trim()) return formatImportNotice(data);
  if (data?.message) return formatImportNotice(data.message);
  if (data?.error) return formatImportNotice(data.error);
  if (data?.detail) return formatImportNotice(data.detail);
  return formatImportNotice(err?.message || 'Import batch failed');
}

function failedChunkResult(chunk, err) {
  const message = bulkImportErrorMessage(err);
  const rows = Array.isArray(chunk) ? chunk : [];
  return {
    imported: 0,
    imported_count: 0,
    skipped: 0,
    skipped_count: 0,
    errors: Math.max(1, rows.length),
    error_count: Math.max(1, rows.length),
    records: [],
    skip_messages: [],
    errorRecords: rows.length
      ? rows.map((row, index) => ({
          row: row?._row ?? row?.row ?? null,
          message: rows.length === 1 ? message : `${message} (batch row ${index + 1})`,
        }))
      : [{ row: null, message }],
    created_ids: [],
  };
}

async function postBulkImportChunk(apiClient, url, chunk, campaign_id, timeout) {
  const body = { records: chunk };
  if (campaign_id) body.campaign_id = campaign_id;
  const res = await apiClient.post(url, body, { timeout });
  return res.data?.data || res.data || {};
}

/**
 * Post one chunk; on failure, split to isolate bad rows down to minChunkSize.
 * Single-row failures are recorded and skipped so the rest of the import can continue.
 */
async function postBulkImportChunkWithSplit(
  apiClient,
  url,
  chunk,
  { campaign_id, timeout, minChunkSize = BULK_IMPORT_MIN_CHUNK_SIZE, onProgress } = {},
) {
  try {
    return [await postBulkImportChunk(apiClient, url, chunk, campaign_id, timeout)];
  } catch (err) {
    if (chunk.length > Math.max(1, minChunkSize)) {
      const mid = Math.ceil(chunk.length / 2);
      const left = chunk.slice(0, mid);
      const right = chunk.slice(mid);
      onProgress?.({
        phase: 'split',
        message: `Server rejected a batch of ${chunk.length}; retrying as ${left.length} + ${right.length}…`,
      });
      const leftResults = await postBulkImportChunkWithSplit(apiClient, url, left, {
        campaign_id,
        timeout,
        minChunkSize,
        onProgress,
      });
      const rightResults = await postBulkImportChunkWithSplit(apiClient, url, right, {
        campaign_id,
        timeout,
        minChunkSize,
        onProgress,
      });
      return [...leftResults, ...rightResults];
    }

    // Last-resort single (or min-size) batch failed — skip it, keep importing the rest.
    onProgress?.({
      phase: 'row_error',
      message: `Skipped ${chunk.length} row(s): ${bulkImportErrorMessage(err)}`,
    });
    return [failedChunkResult(chunk, err)];
  }
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
    const explicitImported = Number(row.imported ?? row.imported_count ?? 0) || 0;
    const rowRecords = Array.isArray(row.records) ? row.records : [];
    const rowIds = Array.isArray(row.created_ids)
      ? row.created_ids
      : rowRecords.map((r) => r?.id).filter(Boolean);

    // Some responses omit `imported` but still return created rows — count those too.
    imported += explicitImported || rowRecords.length || rowIds.length || 0;
    skipped += Number(row.skipped ?? row.skipped_count ?? 0) || 0;
    errors += Number(row.errors ?? row.error_count ?? 0) || 0;

    if (rowRecords.length) records.push(...rowRecords);
    if (Array.isArray(row.skip_messages)) skip_messages.push(...row.skip_messages);
    if (Array.isArray(row.errorRecords)) errorRecords.push(...row.errorRecords);
    else if (Array.isArray(row.errors) && row.errors.length && typeof row.errors[0] === 'object') {
      errorRecords.push(...row.errors);
    }

    created_ids.push(...rowIds);
  }

  imported = Math.max(imported, records.length, created_ids.length);

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
    partial: (errors || errorRecords.length || skipped) > 0 && imported > 0,
  };
}

/**
 * POST records to a bulk-import endpoint in chunks with an extended timeout.
 * Keeps campaign_id on every chunk when provided.
 * On failure, automatically splits the failing batch and continues remaining chunks.
 */
export async function postBulkImportInChunks(
  apiClient,
  url,
  {
    records = [],
    campaign_id,
    chunkSize = BULK_IMPORT_CHUNK_SIZE,
    timeout = BULK_IMPORT_TIMEOUT_MS,
    minChunkSize = BULK_IMPORT_MIN_CHUNK_SIZE,
    onProgress,
  } = {},
) {
  const chunks = chunkArray(records, chunkSize);
  if (!chunks.length) {
    return mergeBulkImportResults([]);
  }

  const results = [];
  for (let i = 0; i < chunks.length; i += 1) {
    const chunk = chunks[i];
    onProgress?.({
      phase: 'chunk',
      current: i + 1,
      total: chunks.length,
      rows: chunk.length,
      message: `Importing batch ${i + 1} of ${chunks.length} (${chunk.length} rows)…`,
    });
    const chunkResults = await postBulkImportChunkWithSplit(apiClient, url, chunk, {
      campaign_id,
      timeout,
      minChunkSize,
      onProgress,
    });
    results.push(...chunkResults);
  }
  return mergeBulkImportResults(results);
}

/** Prefer readyRecords length when the API count disagrees. */
export function resolveReadyCount(payload = {}) {
  const records = Array.isArray(payload.readyRecords) ? payload.readyRecords : null;
  if (records) return records.length;
  return Number(payload.ready ?? payload.ready_count ?? 0) || 0;
}

/** Map bulk-upload error rows into toast/modal friendly skip notices. */
export function formatBulkUploadSkipMessages(errorRecords = []) {
  return (errorRecords || [])
    .map((entry) => {
      if (!entry) return null;
      if (typeof entry === 'string') return formatImportNotice(entry);
      const row = entry.row ?? entry.row_number ?? entry.line;
      const message = formatImportNotice(entry.message ?? entry.error ?? String(entry));
      if (!message) return null;
      return row != null ? `Row ${row}: ${message}` : message;
    })
    .filter(Boolean);
}

/** Guard: API ready count vs readyRecords length (truncated payloads cause short imports). */
export function assertReadyRecordsComplete(payload = {}) {
  const readyRecords = Array.isArray(payload.readyRecords) ? payload.readyRecords : [];
  const readyCount = resolveReadyCount(payload);
  const reportedReady = Number(payload.ready ?? payload.ready_count ?? readyCount) || 0;
  if (reportedReady > 0 && readyRecords.length === 0) {
    const err = new Error(
      `Validation found ${reportedReady} ready row(s), but the server returned none to import. Try a smaller file or contact support.`,
    );
    err.code = 'READY_RECORDS_EMPTY';
    throw err;
  }
  if (reportedReady > 0 && readyRecords.length < reportedReady) {
    const err = new Error(
      `Validation found ${reportedReady} ready row(s), but only ${readyRecords.length} were returned for import. Try splitting the CSV into smaller files.`,
    );
    err.code = 'READY_RECORDS_TRUNCATED';
    throw err;
  }
  return readyRecords;
}
