'use client';
import { useCallback, useEffect, useState } from 'react';
import CRMLayout from '../../components/layout/CRMLayout.js';
import ListPageHeader from '../../components/layout/ListPageHeader.js';
import { DateFilter } from '../../components/layout/ListFilterFields.js';
import { useToast } from '../../components/ui/Toast.js';
import { useAuth } from '../../hooks/useAuth.js';
import { usePermissions } from '../../hooks/usePermissions.js';
import { getApiError } from '../../lib/api.js';
import * as auditLogsApi from '../../lib/services/auditLogs.js';
import { matchesDateRange } from '../../lib/listRecordFilters.js';

const DEFAULT_ACTIVITY_FROM = '';
const DEFAULT_ACTIVITY_TO = '';

function formatWhen(iso) {
  if (!iso) return '—';
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? iso : date.toLocaleString();
}

function activityTypeLabel(log) {
  if (log.source === 'cloudtalk') return 'Call';
  const summary = String(log.summary || '').toLowerCase();
  if (summary.includes('email')) return 'Email';
  if (summary.includes('linkedin')) return 'LinkedIn';
  return 'Activity';
}

export default function AuditLogsPage() {
  const { showToast } = useToast();
  const { user } = useAuth();
  const { can, isSuperAdmin, isSalesManager } = usePermissions();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activityFrom, setActivityFrom] = useState(DEFAULT_ACTIVITY_FROM);
  const [activityTo, setActivityTo] = useState(DEFAULT_ACTIVITY_TO);

  const canViewAuditLogs = can('audit_logs', 'view');

  const loadLogs = useCallback(async () => {
    if (!user?.id || !canViewAuditLogs) return;
    setLoading(true);
    try {
      const canSeeAllLogs = isSuperAdmin || isSalesManager;
      const allLogs = await auditLogsApi.listActivityLogsLastDays(30, {
        user,
        canSeeAll: canSeeAllLogs,
        activity_from: activityFrom || undefined,
        activity_to: activityTo || undefined,
        ...(canSeeAllLogs ? {} : { user_id: user.id }),
      });
      const filtered = allLogs.filter((log) => matchesDateRange(
        log.created_at,
        activityFrom,
        activityTo,
      ));
      setLogs(filtered);
    } catch (err) {
      showToast(getApiError(err));
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }, [activityFrom, activityTo, canViewAuditLogs, isSalesManager, isSuperAdmin, showToast, user]);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  if (!canViewAuditLogs) {
    return (
      <CRMLayout>
        <div className="p-6">
          <h1 className="text-xl font-bold mb-2">Audit Logs</h1>
          <p className="text-gray-500 text-sm">Your role does not have access to audit logs.</p>
        </div>
      </CRMLayout>
    );
  }

  return (
    <CRMLayout>
      <div className="p-6">
        <ListPageHeader
          title="Audit Logs"
          subtitle="Calls, emails, LinkedIn outreach, and CRM activity"
        />

        <div className="flex flex-wrap gap-3 mb-4">
          <DateFilter label="Activity from" value={activityFrom} onChange={setActivityFrom} />
          <DateFilter label="Activity to" value={activityTo} onChange={setActivityTo} />
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-48">
            <div className="w-8 h-8 border-[3px] border-brand-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : logs.length === 0 ? (
          <div className="card p-8 text-center text-sm text-zoho-muted">
            No activity found for the selected date range.
          </div>
        ) : (
          <div className="card divide-y divide-zoho-border">
            {logs.map((log) => (
              <div key={log.id} className="px-5 py-4 hover:bg-brand-50/40 transition-colors">
                <p className="text-sm font-medium text-zoho-text">{log.summary}</p>
                <p className="text-xs text-zoho-muted mt-1">
                  {activityTypeLabel(log)}
                  {' · '}
                  {log.user_name || 'System'}
                  {log.source === 'cloudtalk' ? ' · CloudTalk' : ''}
                  {' · '}
                  {formatWhen(log.created_at)}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </CRMLayout>
  );
}
