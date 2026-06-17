/** Trigger browser download from a blob API response */
export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

/** Normalize POST /leads/import or /contacts/import response */
export function normalizeImportResult(data = {}) {
  return {
    dry_run: data.dry_run,
    total_rows: data.total_rows ?? 0,
    ready: data.ready_count ?? data.ready ?? 0,
    ready_count: data.ready_count ?? data.ready ?? 0,
    imported_count: data.imported_count ?? 0,
    skipped_count: data.skipped_count ?? 0,
    errors: data.error_count ?? data.errors?.length ?? 0,
    error_count: data.error_count ?? data.errors?.length ?? 0,
    errorRecords: (data.errors || []).map((e) => ({
      row: e.row ?? e.row_number ?? e.line,
      error: e.error ?? e.message ?? String(e),
    })),
    warnings: data.warnings || [],
    created_ids: data.created_ids || [],
  };
}
