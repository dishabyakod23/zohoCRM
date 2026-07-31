'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from './useAuth.js';
import { withDefaultOwnerFilters, defaultOwnerFilterId } from '../lib/listRecordFilters.js';

/**
 * List filter state with owner_id defaulting to the logged-in user (all owners for super admin).
 * Resets to the default owner when the user session loads or when clearFilters() is called.
 */
export function useDefaultOwnerFilters(emptyFilters) {
  const { user } = useAuth();
  const emptyFiltersRef = useRef(emptyFilters);
  emptyFiltersRef.current = emptyFilters;

  const [filters, setFilters] = useState(() => withDefaultOwnerFilters(emptyFilters, null));

  useEffect(() => {
    if (!user?.id) return;
    setFilters(withDefaultOwnerFilters(emptyFiltersRef.current, user));
  }, [user?.id, user?.role]);

  const clearFilters = useCallback(() => {
    setFilters(withDefaultOwnerFilters(emptyFiltersRef.current, user));
  }, [user]);

  return {
    filters,
    setFilters,
    clearFilters,
    defaultOwnerId: defaultOwnerFilterId(user),
  };
}
