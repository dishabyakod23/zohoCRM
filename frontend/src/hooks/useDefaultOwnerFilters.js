'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from './useAuth.js';
import { readStoredAuthUser } from '../lib/authHelpers.js';
import { withDefaultOwnerFilters, defaultOwnerFilterId } from '../lib/listRecordFilters.js';

/**
 * List filter state with owner_id defaulting to the logged-in user.
 * Resets to the default owner when the user session loads or when clearFilters() is called.
 */
export function useDefaultOwnerFilters(emptyFilters) {
  const { user } = useAuth();
  const emptyFiltersRef = useRef(emptyFilters);
  emptyFiltersRef.current = emptyFilters;

  const [filters, setFilters] = useState(() => withDefaultOwnerFilters(emptyFilters, readStoredAuthUser()));

  useEffect(() => {
    if (!user?.id) return;
    setFilters((current) => {
      const next = withDefaultOwnerFilters(emptyFiltersRef.current, user);
      const defaultOwnerId = defaultOwnerFilterId(user);
      const ownerUnchanged = !current.owner_id || String(current.owner_id) === String(defaultOwnerId);
      return ownerUnchanged ? next : { ...next, owner_id: current.owner_id };
    });
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
