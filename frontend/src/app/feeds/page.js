'use client';
import { useEffect, useState, useCallback } from 'react';
import CRMLayout from '../../components/layout/CRMLayout.js';
import { useToast } from '../../components/ui/Toast.js';
import { getApiError } from '../../lib/api.js';
import * as auditLogsApi from '../../lib/services/auditLogs.js';

export default function FeedsPage() {
  const { showToast } = useToast();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const result = await auditLogsApi.listAuditLogs({ page: 1, page_size: 30 });
      setLogs(result.data);
    } catch (err) {
      showToast(getApiError(err));
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  return (
    <CRMLayout>
      <div className="p-6 max-w-3xl">
        <h1 className="text-lg font-semibold mb-1">Feeds</h1>
        <p className="text-sm text-zoho-muted mb-6">Recent CRM activity from audit logs</p>
        <div className="card divide-y">
          {loading ? <p className="p-6 text-center text-gray-400">Loading...</p>
          : logs.length === 0 ? <p className="p-6 text-center text-gray-400">No activity yet</p>
          : logs.map(log => (
            <div key={log.id} className="p-4 flex gap-3">
              <span className="w-2 h-2 rounded-full bg-brand-500 mt-2 shrink-0" />
              <div>
                <p className="text-sm font-medium text-zoho-text">{log.summary}</p>
                <p className="text-xs text-zoho-muted mt-0.5">
                  {log.user_name} · {new Date(log.created_at).toLocaleString()}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </CRMLayout>
  );
}
