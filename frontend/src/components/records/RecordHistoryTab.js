'use client';
import { useEffect, useState } from 'react';
import { useToast } from '../ui/Toast.js';
import { getApiError } from '../../lib/api.js';
import { getEntityTimeline } from '../../lib/services/auditLogs.js';
import { TabPanelSkeleton } from './RecordDetailSkeleton.js';

export default function RecordHistoryTab({ entityType, recordId }) {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [entries, setEntries] = useState([]);

  useEffect(() => {
    if (!entityType || !recordId) return;
    setLoading(true);
    getEntityTimeline(entityType, recordId)
      .then(setEntries)
      .catch((err) => showToast(getApiError(err)))
      .finally(() => setLoading(false));
  }, [entityType, recordId, showToast]);

  if (loading) return <TabPanelSkeleton rows={3} />;

  if (!entries.length) {
    return (
      <div className="card p-8 text-center text-sm text-zoho-muted">
        No audit history for this record yet.
      </div>
    );
  }

  return (
    <div className="card divide-y divide-zoho-border">
      {entries.map((entry) => (
        <div key={entry.id} className="px-5 py-3">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-sm font-medium text-zoho-text">{entry.action_label || entry.action}</p>
              {entry.field_name && (
                <p className="text-xs text-zoho-muted mt-0.5">
                  {entry.field_name}: {entry.old_value || '—'} → {entry.new_value || '—'}
                </p>
              )}
              <p className="text-xs text-zoho-muted mt-1">{entry.user_name || 'System'}</p>
            </div>
            <span className="text-xs text-zoho-muted shrink-0">
              {entry.created_at ? new Date(entry.created_at).toLocaleString() : '—'}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
