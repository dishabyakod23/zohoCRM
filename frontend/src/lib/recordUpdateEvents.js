export const RECORD_LIST_STALE_KEY = 'crm:record-list-stale';

/** Mark list views stale after a detail-page save (list may be unmounted). */
export function markRecordListStale() {
  if (typeof window === 'undefined') return;
  sessionStorage.setItem(RECORD_LIST_STALE_KEY, String(Date.now()));
}

/** Returns true once per stale mark; call on list mount / return to refetch. */
export function consumeRecordListStale() {
  if (typeof window === 'undefined') return false;
  if (!sessionStorage.getItem(RECORD_LIST_STALE_KEY)) return false;
  sessionStorage.removeItem(RECORD_LIST_STALE_KEY);
  return true;
}
