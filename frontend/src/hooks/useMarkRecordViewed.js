'use client';
import { useEffect } from 'react';
import { markRecordViewed } from '../lib/recordViewTracker.js';
import { isValidRecordId } from './useRecordId.js';

export function useMarkRecordViewed(entityType, recordId) {
  useEffect(() => {
    if (entityType && recordId && isValidRecordId(recordId)) {
      markRecordViewed(entityType, recordId);
    }
  }, [entityType, recordId]);
}
