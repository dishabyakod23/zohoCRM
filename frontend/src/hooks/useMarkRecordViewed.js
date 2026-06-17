'use client';
import { useEffect } from 'react';
import { markRecordViewed } from '../lib/recordViewTracker.js';

export function useMarkRecordViewed(entityType, recordId) {
  useEffect(() => {
    if (entityType && recordId) markRecordViewed(entityType, recordId);
  }, [entityType, recordId]);
}
