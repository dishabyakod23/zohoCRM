'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from './useAuth.js';
import { readStoredAuthUser } from '../lib/authHelpers.js';
import { withDefaultOwnerFilters, defaultOwnerFilterId } from '../lib/listRecordFilters.js';

/**
 * List filter state with owner_id defaulting to the logged-in user.
 * Resets to the default owner when the user session loads or when clearFilters() is called.
 *
 * Pass `{ applyDefaultOwner: false }` only for lists that should never scope to the logged-in user.
 */
export function useDefaultOwnerFilters(emptyFilters, { applyDefaultOwner = true } = {}) {
  const { user } = useAuth();
  const emptyFiltersRef = useRef(emptyFilters);
  emptyFiltersRef.current = emptyFilters;
  const applyDefaultOwnerRef = useRef(applyDefaultOwner);
  applyDefaultOwnerRef.current = applyDefaultOwner;

  const buildFilters = useCallback((authUser) => {
    if (!applyDefaultOwnerRef.current) {
      return { ...emptyFiltersRef.current, owner_id: '' };
    }
    return withDefaultOwnerFilters(emptyFiltersRef.current, authUser);
  }, []);

  const [filters, setFilters] = useState(() => buildFilters(readStoredAuthUser()));

  useEffect(() => {
    if (!user?.id) return;
    setFilters((current) => {
      const next = buildFilters(user);
      if (!applyDefaultOwnerRef.current) {
        return { ...next, owner_id: current.owner_id || '' };
      }
      const defaultOwnerId = defaultOwnerFilterId(user);
      const ownerUnchanged = !current.owner_id || String(current.owner_id) === String(defaultOwnerId);
      return ownerUnchanged ? next : { ...next, owner_id: current.owner_id };
    });
  }, [user?.id, user?.role, buildFilters, applyDefaultOwner]);

  const clearFilters = useCallback(() => {
    setFilters(buildFilters(user));
  }, [user, buildFilters]);

  return {
    filters,
    setFilters,
    clearFilters,
    defaultOwnerId: applyDefaultOwner ? defaultOwnerFilterId(user) : '',
  };
}
