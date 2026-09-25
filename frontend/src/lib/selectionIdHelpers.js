/** Match list-row ids across bare UUID and `entity:uuid` forms. */

export function expandSelectionId(id) {
  const raw = String(id || '').trim();
  if (!raw) return [];
  const variants = [raw];
  const splitAt = raw.indexOf(':');
  if (splitAt > 0) {
    const bare = raw.slice(splitAt + 1).trim();
    if (bare) variants.push(bare);
  }
  return variants;
}

/** Build a Set that contains every selected id plus its bare UUID form. */
export function buildSelectionLookup(ids = []) {
  const set = new Set();
  for (const id of ids || []) {
    for (const variant of expandSelectionId(id)) set.add(variant);
  }
  return set;
}

export function isSelectionIdSelected(lookup, rowId) {
  if (!lookup?.size || rowId == null || rowId === '') return false;
  for (const variant of expandSelectionId(rowId)) {
    if (lookup.has(variant)) return true;
  }
  return false;
}
