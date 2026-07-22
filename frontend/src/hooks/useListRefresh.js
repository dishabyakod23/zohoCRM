'use client';

import { useEffect, useRef } from 'react';
import { consumeRecordListStale } from '../lib/recordUpdateEvents.js';

/** Refetch list data after detail edits, browser back, or bfcache restore. */
export function useListRefresh(refetch) {
  const refetchRef = useRef(refetch);
  refetchRef.current = refetch;

  useEffect(() => {
    const run = () => refetchRef.current?.();

    if (consumeRecordListStale()) run();

    const onPageShow = (event) => {
      if (event.persisted) run();
    };

    const onPopState = () => {
      window.requestAnimationFrame(run);
    };

    window.addEventListener('pageshow', onPageShow);
    window.addEventListener('popstate', onPopState);

    return () => {
      window.removeEventListener('pageshow', onPageShow);
      window.removeEventListener('popstate', onPopState);
    };
  }, []);
}
