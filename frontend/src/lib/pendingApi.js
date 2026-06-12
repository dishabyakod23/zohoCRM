export const PENDING_API_MSG = 'This module is not available on the Sales CRM API yet.';

export function stubListFetch(setLoading, setItems, setTotal) {
  setLoading(false);
  setItems([]);
  setTotal(0);
}
