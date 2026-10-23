'use client';

import { useEffect, useRef } from 'react';
import { invalidateFullListCache } from './requestCache.js';

export const CRM_DATA_CHANGED_EVENT = 'crm-data-changed';
export const CRM_DATA_CHANGED_STORAGE_KEY = 'crm-data-changed-at';
export const DASHBOARD_CACHE_PREFIX = 'crm-dashboard-cache-v1';

export function clearDashboardLocalCache() {
  if (typeof window === 'undefined') return;
  try {
    const keys = [];
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const key = window.localStorage.key(i);
      if (key && key.startsWith(DASHBOARD_CACHE_PREFIX)) keys.push(key);
    }
    keys.forEach((key) => window.localStorage.removeItem(key));
  } catch {
    // ignore
  }
}

/** After a CRM write (or another tab's write), drop list caches so dashboards refetch. */
export function emitCrmDataChanged() {
  if (typeof window === 'undefined') return;
  invalidateFullListCache();
  clearDashboardLocalCache();
  window.dispatchEvent(new Event(CRM_DATA_CHANGED_EVENT));
  try {
    window.localStorage.setItem(CRM_DATA_CHANGED_STORAGE_KEY, String(Date.now()));
  } catch {
    // ignore
  }
}

/** Refetch when the tab is focused again, or when CRM data changes in this/other tabs. */
export function useCrmLiveRefresh(onRefresh, { minIntervalMs = 2000, pollIntervalMs = 0 } = {}) {
  const cbRef = useRef(onRefresh);
  cbRef.current = onRefresh;

  useEffect(() => {
    let last = 0;
    const run = () => {
      const now = Date.now();
      if (now - last < minIntervalMs) return;
      last = now;
      cbRef.current?.();
    };
    const onVisible = () => {
      if (document.visibilityState === 'visible') run();
    };
    const onStorage = (event) => {
      if (event.key === CRM_DATA_CHANGED_STORAGE_KEY) run();
    };
    window.addEventListener(CRM_DATA_CHANGED_EVENT, run);
    window.addEventListener('focus', run);
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('storage', onStorage);
    const timer = pollIntervalMs > 0
      ? window.setInterval(() => {
        if (document.visibilityState === 'visible') run();
      }, pollIntervalMs)
      : null;
    return () => {
      if (timer) window.clearInterval(timer);
      window.removeEventListener(CRM_DATA_CHANGED_EVENT, run);
      window.removeEventListener('focus', run);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('storage', onStorage);
    };
  }, [minIntervalMs, pollIntervalMs]);
}
