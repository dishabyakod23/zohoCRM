/** Parse a single CSV line respecting quoted fields */
function parseCsvLine(line) {
  const values = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      values.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  values.push(current.trim());
  return values;
}

function escapeCsvCell(value) {
  const str = String(value ?? '');
  if (/[",\n\r]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
  return str;
}

export function normalizeHeaderKey(header) {
  return String(header || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
}

/** Parse CSV text into { headers, rows } where rows use original header keys */
export function parseCsvText(csvText) {
  const lines = csvText.replace(/^\uFEFF/, '').split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 1) return { headers: [], rows: [] };

  const headers = parseCsvLine(lines[0]).map((h) => h.trim()).filter(Boolean);
  const rows = lines.slice(1).map((line, index) => {
    const values = parseCsvLine(line);
    const row = { _row: index + 2 };
    headers.forEach((header, i) => {
      row[header] = values[i] ?? '';
    });
    return row;
  });

  return { headers, rows };
}

export async function parseCsvFile(file) {
  const text = await file.text();
  return parseCsvText(text);
}

/** Suggest CRM field key for each CSV column header */
export function suggestColumnMapping(headers, fieldDefs) {
  const used = new Set();
  const mapping = {};

  const fieldByNorm = new Map();
  for (const field of fieldDefs) {
    fieldByNorm.set(normalizeHeaderKey(field.key), field.key);
    fieldByNorm.set(normalizeHeaderKey(field.label), field.key);
    for (const alias of field.aliases || []) {
      fieldByNorm.set(normalizeHeaderKey(alias), field.key);
    }
  }

  for (const header of headers) {
    const norm = normalizeHeaderKey(header);
    const match = fieldByNorm.get(norm);
    if (match && !used.has(match)) {
      mapping[header] = match;
      used.add(match);
    } else {
      mapping[header] = '';
    }
  }

  return mapping;
}

/** Sample non-empty values from a column for preview */
export function columnPreviewValues(rows, header, limit = 5) {
  const samples = [];
  for (const row of rows) {
    const v = String(row[header] ?? '').trim();
    if (v && !samples.includes(v)) samples.push(v);
    if (samples.length >= limit) break;
  }
  return samples;
}

/** Build mapped row objects keyed by CRM field names */
export function applyColumnMapping(rows, mapping) {
  return rows.map((row) => {
    const mapped = { _row: row._row };
    for (const [csvHeader, fieldKey] of Object.entries(mapping)) {
      if (fieldKey) mapped[fieldKey] = row[csvHeader] ?? '';
    }
    return mapped;
  });
}

/** Convert mapped rows to a CSV File for API upload */
export function mappedRowsToCsvFile(mappedRows, fieldKeys, filename = 'import.csv') {
  const keys = fieldKeys.filter((k) => mappedRows.some((r) => r[k] !== undefined && r[k] !== ''));
  const headerLine = keys.join(',');
  const body = mappedRows.map((row) => keys.map((k) => escapeCsvCell(row[k] ?? '')).join(',')).join('\n');
  const csv = `${headerLine}\n${body}`;
  return new File([csv], filename, { type: 'text/csv' });
}

export function getMappedFieldKeys(mapping) {
  return [...new Set(Object.values(mapping).filter(Boolean))];
}

/** Add a column with a default value when the mapped CSV is missing a required API field. */
export function ensureCsvColumn(csv, column, defaultValue) {
  const parsed = parseCsvText(csv);
  if (!parsed.headers.length) return csv;
  const colKey = normalizeHeaderKey(column);
  if (parsed.headers.some((h) => normalizeHeaderKey(h) === colKey)) return csv;

  const newHeaders = [...parsed.headers, column];
  const lines = [newHeaders.join(',')];
  for (const row of parsed.rows) {
    const cells = newHeaders.map((h) => (h === column ? defaultValue : (row[h] ?? '')));
    lines.push(cells.map(escapeCsvCell).join(','));
  }
  return lines.join('\n');
}

export function validateMapping(mapping, fieldDefs) {
  const mappedFields = new Set(Object.values(mapping).filter(Boolean));
  const missing = fieldDefs.filter((f) => f.required && !mappedFields.has(f.key));
  if (missing.length) {
    return `Map required field(s): ${missing.map((f) => f.label).join(', ')}`;
  }
  const duplicates = Object.values(mapping).filter(Boolean);
  const dupSet = duplicates.filter((v, i, arr) => arr.indexOf(v) !== i);
  if (dupSet.length) {
    return `Each CRM field can only be mapped once (duplicate: ${dupSet[0]})`;
  }
  return null;
}
