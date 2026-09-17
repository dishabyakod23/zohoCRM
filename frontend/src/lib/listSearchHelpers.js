/**
 * List-table search helpers.
 *
 * Backend search typically ILIKE-matches the whole query against individual
 * columns (first_name, last_name, email, …). That makes "paul" work but
 * "paul brook" fail, because neither field contains the full string.
 *
 * FE workaround: send the first token to the API for narrowing, then require
 * every token to appear in a concatenated record haystack.
 */

export function tokenizeSearchQuery(search) {
  if (search == null) return [];
  return String(search)
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);
}

/** Fields commonly shown / searched on person-like CRM rows. */
export function personSearchHaystack(record = {}) {
  return [
    record.first_name,
    record.last_name,
    record.name,
    record.full_name,
    record.display_name,
    record.email,
    record.secondary_email,
    record.phone,
    record.mobile,
    record.company,
    record.company_name,
    record.account_name,
    record.title,
    record.designation,
    record.job_title,
  ]
    .filter((v) => v != null && String(v).trim() !== '')
    .join(' ')
    .toLowerCase();
}

export function genericSearchHaystack(record = {}, extraKeys = []) {
  const keys = [
    'name',
    'title',
    'email',
    'phone',
    'description',
    'location',
    'host_name',
    'owner_name',
    'account_name',
    'company_name',
    'subject',
    ...extraKeys,
  ];
  return keys
    .map((k) => record[k])
    .filter((v) => v != null && String(v).trim() !== '')
    .join(' ')
    .toLowerCase();
}

export function matchesSearchTokens(record, tokens, haystackFn = personSearchHaystack) {
  if (!tokens?.length) return true;
  const haystack = haystackFn(record);
  if (!haystack) return false;
  return tokens.every((token) => haystack.includes(token));
}

/**
 * @returns {{
 *   tokens: string[],
 *   apiSearch: string|undefined,
 *   needsClientMatch: boolean,
 * }}
 */
export function resolveListSearch(search) {
  const tokens = tokenizeSearchQuery(search);
  if (!tokens.length) {
    return { tokens: [], apiSearch: undefined, needsClientMatch: false };
  }
  if (tokens.length === 1) {
    return { tokens, apiSearch: tokens[0], needsClientMatch: false };
  }
  // Prefer the longest token for API narrowing (often surname is more selective).
  const apiSearch = [...tokens].sort((a, b) => b.length - a.length)[0];
  return { tokens, apiSearch, needsClientMatch: true };
}

export function filterRowsBySearchTokens(rows, search, haystackFn = personSearchHaystack) {
  const { tokens, needsClientMatch } = resolveListSearch(search);
  if (!needsClientMatch && tokens.length <= 1) {
    if (!tokens.length) return rows;
    return rows.filter((row) => matchesSearchTokens(row, tokens, haystackFn));
  }
  return (rows || []).filter((row) => matchesSearchTokens(row, tokens, haystackFn));
}

/**
 * When multi-word search needs client AND-matching, page through the API using
 * apiSearch, filter, then slice for the requested page.
 */
export async function listWithTokenSearch({
  search,
  page = 1,
  page_size = 25,
  fetchPage,
  haystackFn = personSearchHaystack,
  maxRecords = 2500,
  fetchPageSize = 250,
}) {
  const { tokens, apiSearch, needsClientMatch } = resolveListSearch(search);

  if (!needsClientMatch) {
    return fetchPage({ page, page_size, search: apiSearch });
  }

  const collected = [];
  let serverTotal = 0;
  let pageNum = 1;

  while (pageNum <= 50 && collected.length < maxRecords) {
    const result = await fetchPage({
      page: pageNum,
      page_size: fetchPageSize,
      search: apiSearch,
    });
    const batch = result?.data || [];
    serverTotal = result?.total ?? result?.meta?.total ?? collected.length + batch.length;
    collected.push(...batch);
    if (!batch.length || collected.length >= serverTotal) break;
    pageNum += 1;
  }

  const filtered = collected.filter((row) => matchesSearchTokens(row, tokens, haystackFn));
  const start = (page - 1) * page_size;
  return {
    data: filtered.slice(start, start + page_size),
    total: filtered.length,
    meta: { total: filtered.length },
  };
}
