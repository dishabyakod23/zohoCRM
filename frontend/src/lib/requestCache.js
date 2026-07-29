const store = new Map();
const inflight = new Map();

/**
 * Cache async fetch results with TTL and in-flight deduplication.
 * @param {string} key
 * @param {() => Promise<T>} loader
 * @param {number} ttlMs
 * @returns {Promise<T>}
 */
export async function cachedRequest(key, loader, ttlMs = 5 * 60 * 1000) {
  const now = Date.now();
  const hit = store.get(key);
  if (hit && now - hit.at < ttlMs) return hit.value;

  if (inflight.has(key)) return inflight.get(key);

  const promise = Promise.resolve()
    .then(loader)
    .then((value) => {
      store.set(key, { value, at: Date.now() });
      return value;
    })
    .finally(() => {
      inflight.delete(key);
    });

  inflight.set(key, promise);
  return promise;
}

export function invalidateCachedRequest(key) {
  store.delete(key);
  inflight.delete(key);
}

export function invalidateCachedRequestPrefix(prefix) {
  for (const key of store.keys()) {
    if (key.startsWith(prefix)) store.delete(key);
  }
  for (const key of inflight.keys()) {
    if (key.startsWith(prefix)) inflight.delete(key);
  }
}
