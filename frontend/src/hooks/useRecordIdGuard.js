'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { isValidRecordId, getRecordIdFromPathname } from './useRecordId.js';
import { useToast } from '../components/ui/Toast.js';

/**
 * Resolves static-export record IDs from the URL and redirects when the id is invalid.
 * Returns true when the page should load data for `id`.
 */
export function useRecordIdGuard(id, { fallbackPath = '/dashboard', message = 'Record not found' } = {}) {
  const router = useRouter();
  const { showToast } = useToast();
  const ready = isValidRecordId(id);

  useEffect(() => {
    if (typeof window === 'undefined' || ready) return undefined;
    const timer = window.setTimeout(() => {
      const fromPath = getRecordIdFromPathname(window.location.pathname);
      if (!isValidRecordId(fromPath)) {
        showToast(message);
        router.push(fallbackPath);
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [id, ready, fallbackPath, message, router, showToast]);

  return ready;
}
