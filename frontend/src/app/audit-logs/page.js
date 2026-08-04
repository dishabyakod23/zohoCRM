'use client';
import { useCallback, useEffect, useState } from 'react';
import CRMLayout from '../../components/layout/CRMLayout.js';
import ListPageHeader from '../../components/layout/ListPageHeader.js';
import { useToast } from '../../components/ui/Toast.js';
import { useAuth } from '../../hooks/useAuth.js';
import { usePermissions } from '../../hooks/usePermissions.js';
import { getApiError } from '../../lib/api.js';
import * as auditLogsApi from '../../lib/services/auditLogs.js';

const AUDIT_LOG_DAYS = 30;

function formatWhen(iso) {
  if (!iso) return '—';
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? iso : date.toLocaleString();
}

export default function AuditLogsPage() {
  const { showToast } = useToast();
  const { user } = useAuth();
  const { role, can, isSuperAdmin, isSalesManager } = usePermissions();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  const canViewAuditLogs = can('audit_logs', 'view');

  const loadLogs = useCallback(async () => {
    if (!user?.id || !canViewAuditLogs) return;
    setLoading(true);
    try {
      const canSeeAllLogs = isSuperAdmin || isSalesManager;
      const allLogs = await auditLogsApi.listActivityLogsLastDays(AUDIT_LOG_DAYS, {
        user,
        canSeeAll: canSeeAllLogs,
        ...(canSeeAllLogs ? {} : { user_id: user.id }),
      });
      setLogs(allLogs);
    } catch (err) {
      showToast(getApiError(err));
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }, [canViewAuditLogs, isSalesManager, isSuperAdmin, role, showToast, user?.id]);

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
          subtitle={`CRM activity and CloudTalk calls from the last ${AUDIT_LOG_DAYS} days (sign-in and system noise excluded)`}
        />

        {loading ? (
          <div className="flex items-center justify-center h-48">
            <div className="w-8 h-8 border-[3px] border-brand-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : logs.length === 0 ? (
          <div className="card p-8 text-center text-sm text-zoho-muted">
            No audit logs found for the last {AUDIT_LOG_DAYS} days.
          </div>
        ) : (
          <div className="card divide-y divide-zoho-border">
            {logs.map((log) => (
              <div key={log.id} className="px-5 py-4 hover:bg-brand-50/40 transition-colors">
                <p className="text-sm font-medium text-zoho-text">{log.summary}</p>
                <p className="text-xs text-zoho-muted mt-1">
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
