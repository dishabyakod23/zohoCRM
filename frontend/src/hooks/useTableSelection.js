import { useMemo, useCallback } from 'react';

export function useTableSelection({ total, fetchAllIds, resetDeps = [] }) {
  const selectionResetKey = useMemo(
    () => JSON.stringify(resetDeps),
    resetDeps,
  );

  const fetchAllMatchingIds = useCallback(
    () => (fetchAllIds ? fetchAllIds() : Promise.resolve([])),
    [fetchAllIds],
  );

  return {
    totalMatching: total,
    fetchAllMatchingIds: fetchAllIds ? fetchAllMatchingIds : undefined,
    selectionResetKey,
  };
}
