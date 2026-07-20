'use client';
import { useEffect, useState } from 'react';
import { useToast } from '../ui/Toast.js';
import { getApiError } from '../../lib/api.js';
import { getEntityHistory } from '../../lib/services/auditLogs.js';
import { TabPanelSkeleton } from './RecordDetailSkeleton.js';

const ACTION_COLORS = {
  create: 'bg-green-100 text-green-700',
  update: 'bg-blue-100 text-blue-700',
  delete: 'bg-red-100 text-red-700',
  convert: 'bg-purple-100 text-purple-700',
};

export default function RecordHistoryTab({ entityType, recordId }) {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [entries, setEntries] = useState([]);

  useEffect(() => {
    if (!entityType || !recordId) return;
    setLoading(true);
    getEntityHistory(entityType, recordId)
      .then(setEntries)
      .catch((err) => showToast(getApiError(err)))
      .finally(() => setLoading(false));
  }, [entityType, recordId, showToast]);

  if (loading) return <TabPanelSkeleton rows={3} />;

  if (!entries.length) {
    return (
      <div className="card p-8 text-center text-sm text-zoho-muted">
        No history for this record yet.
      </div>
    );
  }

  return (
    <div className="card divide-y divide-zoho-border">
      {entries.map((entry) => {
        const actionKey = (entry.action || '').toLowerCase();
        const badgeClass = ACTION_COLORS[actionKey] || 'bg-gray-100 text-gray-600';
        const lines = entry.change_lines?.length ? entry.change_lines : null;
        const singleField = !lines && entry.field_name;

        return (
          <div key={entry.id} className="px-5 py-4">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wide ${badgeClass}`}>
                    {entry.action_label || entry.action}
                  </span>
                  <p className="text-sm font-medium text-zoho-text">
                    {entry.summary || entry.entity_type_label || entry.entity_type}
                  </p>
                </div>

                {lines && (
                  <ul className="mt-2 space-y-0.5">
                    {lines.map((line, i) => (
                      <li key={i} className="text-xs text-zoho-muted font-mono">{line}</li>
                    ))}
                  </ul>
                )}

                {singleField && (
                  <p className="text-xs text-zoho-muted mt-1 font-mono">
                    {entry.field_name}: {entry.old_value || '—'} → {entry.new_value || '—'}
                  </p>
                )}

                <p className="text-xs text-zoho-muted mt-1.5">{entry.user_name || 'System'}</p>
              </div>
              <span className="text-xs text-zoho-muted shrink-0 whitespace-nowrap">
                {entry.created_at ? new Date(entry.created_at).toLocaleString() : '—'}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
