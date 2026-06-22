'use client';
import { useEffect, useState, useCallback, useMemo } from 'react';
import Link from 'next/link';
import CRMLayout from '../../components/layout/CRMLayout.js';
import ListPageHeader from '../../components/layout/ListPageHeader.js';
import ListSearchBar from '../../components/layout/ListSearchBar.js';
import Badge from '../../components/ui/Badge.js';
import RecordDataTable from '../../components/records/RecordDataTable.js';
import { useToast } from '../../components/ui/Toast.js';
import { usePermissions } from '../../hooks/usePermissions.js';
import { useDebouncedValue } from '../../hooks/useDebouncedValue.js';
import { getApiError } from '../../lib/api.js';
import * as campaignsApi from '../../lib/services/campaigns.js';
import { fetchCampaignStatuses } from '../../lib/services/lookups.js';
import { tableLinkClass } from '../../lib/tableStyles.js';

const LIMIT = 15;

export default function CampaignsPage() {
  const { showToast } = useToast();
  const { canEdit } = usePermissions();
  const [items, setItems] = useState([]);
  const [statusOptions, setStatusOptions] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search);
  const [page, setPage] = useState(1);

  useEffect(() => {
    fetchCampaignStatuses().then(setStatusOptions).catch(() => {});
  }, []);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const result = await campaignsApi.listCampaigns({ page, page_size: LIMIT, search: debouncedSearch || undefined });
      setItems(result.data);
      setTotal(result.total);
    } catch (err) {
      showToast(getApiError(err));
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch, showToast]);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  const totalPages = Math.ceil(total / LIMIT) || 1;

  const columns = useMemo(() => [
    { id: 'name', header: 'Name', cell: (c) => <Link href={`/campaigns/${c.id}`} className={tableLinkClass}>{c.name}</Link> },
    { id: 'type', header: 'Type', cell: (c) => c.type_label },
    { id: 'status', header: 'Status', cell: (c) => <Badge label={c.status_label} /> },
    { id: 'dates', header: 'Dates', cell: (c) => <span className="text-xs">{c.start_date} → {c.end_date}</span> },
    { id: 'members', header: 'Members', cell: (c) => c.member_count || 0 },
  ], []);

  return (
    <CRMLayout>
      <div className="p-6">
        <ListPageHeader
          title="Campaigns"
          subtitle="Manage marketing campaigns and outreach."
          primaryAction={canEdit ? (
            <Link href="/campaigns/create" className="btn-primary-sm">Create Campaign</Link>
          ) : null}
        />

        <ListSearchBar
          search={search}
          onSearchChange={(v) => { setSearch(v); setPage(1); }}
          placeholder="Search campaigns…"
          total={total}
          totalLabel="campaigns"
        />

        <div className="card">
          <RecordDataTable
            moduleKey="campaigns"
            records={items}
            loading={loading}
            columns={columns}
            statusOptions={statusOptions}
            onRefresh={fetchItems}
            emptyMessage="No campaigns found"
            pagination={totalPages > 1 ? { page, totalPages, onPageChange: setPage, label: `${page} / ${totalPages}` } : undefined}
          />
        </div>
      </div>
    </CRMLayout>
  );
}
