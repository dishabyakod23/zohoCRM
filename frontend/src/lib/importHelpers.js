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
  const errorRecords = (data.errors || []).map(normalizeImportIssue).filter(Boolean);

  return {
    dry_run: data.dry_run,
    total_rows: data.total_rows ?? 0,
    ready: data.ready_count ?? data.ready ?? 0,
    ready_count: data.ready_count ?? data.ready ?? 0,
    imported_count: data.imported_count ?? 0,
    skipped_count: data.skipped_count ?? 0,
    errors: data.error_count ?? errorRecords.length ?? 0,
    error_count: data.error_count ?? errorRecords.length ?? 0,
    errorRecords,
    warnings: data.warnings || [],
    warning_count: data.skipped_count ?? warningRecords.length ?? 0,
    warningRecords,
    created_ids: data.created_ids || [],
  };
}
