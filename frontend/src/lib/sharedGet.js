function stableKey(value) {
  if (value == null || typeof value !== 'object') return JSON.stringify(value ?? null);
  if (Array.isArray(value)) return `[${value.map(stableKey).join(',')}]`;
  return `{${Object.keys(value).sort().map((k) => `${k}:${stableKey(value[k])}`).join(',')}}`;
}

function copyData(data) {
  if (data == null || typeof data !== 'object') return data;
  try {
    return typeof structuredClone === 'function' ? structuredClone(data) : JSON.parse(JSON.stringify(data));
  } catch {
    return data;
  }
}

/**
 * Wrap an axios-style get so identical GETs already on their way share one request.
 * Pages often re-run their fetch while the session or lookups settle; without this the same
 * slow request went out 2–3 times and the API answered them one after another.
 * Each extra caller gets its own copy of the response data, so callers can't affect each other.
 * Requests with an abort signal or a non-JSON responseType are never shared.
 */
export function shareInflightGets(get) {
  const inflight = new Map();
  return function sharedGet(url, config = {}) {
    if (config.signal || (config.responseType && config.responseType !== 'json')) return get(url, config);
    const key = `${url}|${stableKey(config.params)}`;
    const existing = inflight.get(key);
    if (existing) return existing.then((res) => ({ ...res, data: copyData(res.data) }));
    const request = get(url, config).finally(() => inflight.delete(key));
    inflight.set(key, request);
    return request;
  };
}
