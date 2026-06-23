'use client';
import { useCallback, useEffect, useState } from 'react';
import CRMLayout from '../../components/layout/CRMLayout.js';
import ListPageHeader from '../../components/layout/ListPageHeader.js';
import ListSearchBar from '../../components/layout/ListSearchBar.js';
import { SelectFilter } from '../../components/layout/ListFilterFields.js';
import Link from 'next/link';
import { recordDetailHref } from '../../lib/recordHelpers.js';
import { tableLinkClass } from '../../lib/tableStyles.js';
import { useToast } from '../../components/ui/Toast.js';
import { usePermissions } from '../../hooks/usePermissions.js';
import { getApiError } from '../../lib/api.js';
import * as auditLogsApi from '../../lib/services/auditLogs.js';

const LIMIT = 25;

const ENTITY_TYPES = [
  { value: '', label: 'All types' },
  { value: 'lead', label: 'Lead' },
  { value: 'contact', label: 'Contact' },
  { value: 'account', label: 'Account' },
  { value: 'deal', label: 'Deal' },
  { value: 'campaign', label: 'Campaign' },
  { value: 'task', label: 'Task' },
];

function formatDateTime(value) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

export default function AuditLogsPage() {
  const { showToast } = useToast();
  const { canManageSettings } = usePermissions();
  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [entityType, setEntityType] = useState('');

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const result = await auditLogsApi.listAuditLogs({
        page,
        page_size: LIMIT,
        entity_type: entityType || undefined,
      });
      setLogs(result.data);
      setTotal(result.total);
    } catch (err) {
      showToast(getApiError(err));
    } finally {
      setLoading(false);
    }
  }, [page, entityType, showToast]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  const totalPages = Math.ceil(total / LIMIT) || 1;

  if (!canManageSettings) {
    return (
      <CRMLayout>
        <div className="p-6">
          <h1 className="text-xl font-bold mb-2">Audit Logs</h1>
          <p className="text-gray-500 text-sm">Only super admins can view audit logs.</p>
        </div>
      </CRMLayout>
    );
  }

  return (
    <CRMLayout>
      <div className="p-6">
        <ListPageHeader
          title="Audit Logs"
          subtitle="Track create, update, and delete actions across CRM records."
        />

        <ListSearchBar
          filtersOpen
          filters={(
            <SelectFilter
              label="Record type"
              value={entityType}
              onChange={(v) => { setEntityType(v); setPage(1); }}
              options={ENTITY_TYPES}
            />
          )}
        />

        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-zoho-muted border-b border-zoho-border">
                <th className="px-4 py-3 font-medium">When</th>
                <th className="px-4 py-3 font-medium">User</th>
                <th className="px-4 py-3 font-medium">Action</th>
                <th className="px-4 py-3 font-medium">Record</th>
                <th className="px-4 py-3 font-medium">Field</th>
                <th className="px-4 py-3 font-medium">Change</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zoho-border">
              {loading ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-zoho-muted">Loading…</td></tr>
              ) : logs.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-zoho-muted">No audit entries found</td></tr>
              ) : logs.map((log) => (
                <tr key={log.id}>
                  <td className="px-4 py-3 whitespace-nowrap">{formatDateTime(log.created_at)}</td>
                  <td className="px-4 py-3">{log.user_name || '—'}</td>
                  <td className="px-4 py-3">{log.action_label || log.action}</td>
                  <td className="px-4 py-3">
                    {recordDetailHref(log.entity_type || log.record_type, log.record_id) ? (
                      <Link href={recordDetailHref(log.entity_type || log.record_type, log.record_id)} className={tableLinkClass}>
                        <span className="text-zoho-muted">{log.entity_type_label || log.entity_type || log.record_type}</span>
                        {' '}
                        <span className="font-medium">#{log.record_id}</span>
                      </Link>
                    ) : (
                      <>
                        <span className="text-zoho-muted">{log.entity_type_label || log.entity_type}</span>
                        {' '}
                        <span className="font-medium">#{log.record_id}</span>
                      </>
                    )}
                  </td>
                  <td className="px-4 py-3">{log.field_name || '—'}</td>
                  <td className="px-4 py-3 text-xs text-zoho-muted max-w-xs truncate">
                    {log.field_name ? `${log.old_value || '—'} → ${log.new_value || '—'}` : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-4 text-sm">
            <span className="text-zoho-muted">{total} entries</span>
            <div className="flex gap-2">
              <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="btn-secondary text-xs disabled:opacity-50">Previous</button>
              <span className="px-2 py-1 text-zoho-muted">Page {page} of {totalPages}</span>
              <button type="button" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} className="btn-secondary text-xs disabled:opacity-50">Next</button>
            </div>
          </div>
        )}
      </div>
    </CRMLayout>
  );
}
