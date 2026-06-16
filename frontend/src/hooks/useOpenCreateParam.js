'use client';
import { useEffect } from 'react';

/** Open create modal when URL contains ?create=1 (Quick Create links). */
export function useOpenCreateParam(canEdit, openCreate) {
  useEffect(() => {
    if (typeof window === 'undefined' || !canEdit) return;
    if (new URLSearchParams(window.location.search).get('create') === '1') {
      openCreate();
    }
  }, [canEdit, openCreate]);
}
