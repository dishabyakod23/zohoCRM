'use client';
import { useEffect, useState, useCallback, useMemo } from 'react';
import CRMLayout from '../../components/layout/CRMLayout.js';
import ListPageHeader from '../../components/layout/ListPageHeader.js';
import ListSearchBar from '../../components/layout/ListSearchBar.js';
import Badge from '../../components/ui/Badge.js';
import RecordDataTable from '../../components/records/RecordDataTable.js';
import RecordDetailLink from '../../components/records/RecordDetailLink.js';
import { useToast } from '../../components/ui/Toast.js';
import { useAuth } from '../../hooks/useAuth.js';
import { usePermissions } from '../../hooks/usePermissions.js';
import { useDebouncedValue } from '../../hooks/useDebouncedValue.js';
import { useListRefresh } from '../../hooks/useListRefresh.js';
import { getApiError } from '../../lib/api.js';
import * as accountsApi from '../../lib/services/accounts.js';
import * as leadsApi from '../../lib/services/leads.js';
import { buildAccountProposalRows, groupAccountProposalRows } from '../../lib/accountProposalRows.js';
import { proposalTypeLabel } from '../../lib/pipelineHelpers.js';
import { formatMoney, formatMoneyTotalsByCurrency } from '../../lib/currencies.js';
import { ACCOUNT_TYPES, DEFAULT_PAGE_SIZE } from '../../lib/constants.js';
import { avatarInitialClass } from '../../lib/tableStyles.js';
import { TextFilter, SelectFilter, OwnerFilter, CampaignFilter, CreatedUpdatedDateFilters } from '../../components/layout/ListFilterFields.js';
import { recordTimestampColumns } from '../../lib/listTimestampHelpers.js';
import { fetchUsers, fetchIndustries } from '../../lib/services/lookups.js';
import { EMPTY_ACCOUNT_FILTERS, countActiveFilters } from '../../lib/listRecordFilters.js';
import { useDefaultOwnerFilters } from '../../hooks/useDefaultOwnerFilters.js';
import { DEFAULT_LIST_SORT, getSortApiParams } from '../../lib/listSortHelpers.js';
import { useCampaignLookups } from '../../hooks/useCampaignLookups.js';
import { useCampaignMemberFilter } from '../../hooks/useCampaignMemberFilter.js';
import { useTableSelection } from '../../hooks/useTableSelection.js';
import { navigateToRecord } from '../../lib/recordNavigation.js';

const LIMIT = DEFAULT_PAGE_SIZE;

function formatDate(value) {
  if (!value) return '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : d.toLocaleDateString();
}

function formatDealSize(value, currency) {
  if (value == null || value === '') return '—';
  return formatMoney(value, currency);
}

const ACCOUNT_STATUS_OPTIONS = ACCOUNT_TYPES.map((t) => ({ value: t, label: t }));

export default function AccountsPage() {
  const { showToast } = useToast();
  const { user } = useAuth();
  const { can } = usePermissions();
  const canCreate = can('accounts', 'create');
  const [accounts, setAccounts] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search);
  const [page, setPage] = useState(1);
  const { filters, setFilters, clearFilters } = useDefaultOwnerFilters(EMPTY_ACCOUNT_FILTERS);
  const [users, setUsers] = useState([]);
  const [industryOptions, setIndustryOptions] = useState([]);
  const [sort, setSort] = useState(DEFAULT_LIST_SORT);
  const { campaigns } = useCampaignLookups();
  const { memberIds: campaignMemberIds, ready: campaignMembersReady } = useCampaignMemberFilter(filters.campaign_id, 'account');

  useEffect(() => {
    fetchUsers().then(setUsers).catch(() => setUsers([]));
    fetchIndustries().then(setIndustryOptions).catch(() => setIndustryOptions([]));
  }, []);

  const fetchAccounts = useCallback(async () => {
    if (filters.campaign_id && !campaignMembersReady) return;

    setLoading(true);
    try {
      const result = await accountsApi.listAccounts({
        page,
        page_size: LIMIT,
        search: debouncedSearch || undefined,
        filters,
        campaignMemberIds,
        ...getSortApiParams(sort, 'accounts'),
      });
      setAccounts(result.data);
      setTotal(result.total);
    } catch (err) {
      showToast(getApiError(err));
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch, filters, sort, showToast, campaignMemberIds, campaignMembersReady]);

  useEffect(() => { fetchAccounts(); }, [fetchAccounts]);
  useListRefresh(fetchAccounts);

  const totalPages = Math.ceil(total / LIMIT) || 1;

  const accountListParams = useMemo(() => ({
    search: debouncedSearch || undefined,
    filters,
    campaignMemberIds,
    ...getSortApiParams(sort, 'accounts'),
  }), [debouncedSearch, filters, sort, campaignMemberIds]);

  const fetchAllMatchingAccountIds = useCallback(
    () => accountsApi.listAllMatchingAccountIds(accountListParams),
    [accountListParams],
  );

  const tableSelection = useTableSelection({
    total,
    resetDeps: [debouncedSearch, filters, sort, campaignMemberIds],
    fetchAllIds: fetchAllMatchingAccountIds,
  });

  // Proposals that became accounts, shown under each account like the Proposals table.
  const [convertedProposals, setConvertedProposals] = useState([]);
  useEffect(() => {
    let cancelled = false;
    leadsApi.listConvertedProposals()
      .then((rows) => { if (!cancelled) setConvertedProposals(rows || []); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [accounts]);

  const rows = useMemo(
    () => buildAccountProposalRows(accounts, convertedProposals),
    [accounts, convertedProposals],
  );

  // Account details sit in each group's header row (see groupAccountRows); rows are its proposals.
  const columns = useMemo(() => [
    { id: 'name', header: 'Proposal', cell: (row) => (
      <span className="inline-flex items-center gap-2 pl-4">
        <span className="w-1.5 h-1.5 rounded-full bg-zoho-border" aria-hidden="true" />
        {row._proposal ? (
          <RecordDetailLink href={`/proposals/${row._proposal.id}`} className="text-sm text-zoho-text hover:text-brand-600">
            {`Proposal ${row._proposalNumber}`}
          </RecordDetailLink>
        ) : (
          <span className="text-sm text-zoho-muted">No proposals</span>
        )}
      </span>
    ) },
    { id: 'contact', header: 'Contact', cell: (row) => (
      row._proposal ? `${row._proposal.first_name || ''} ${row._proposal.last_name || ''}`.trim() || '—' : '—'
    ) },
    { id: 'proposal_date', header: 'Proposal Date', cell: (row) => formatDate(row._proposal?.proposal_date) },
    { id: 'deal_size', header: 'Deal Size', cell: (row) => formatDealSize(row._proposal?.deal_size ?? row._proposal?.proposal_amount, row._proposal?.currency) },
    { id: 'proposal_type', header: 'Proposal Type', cell: (row) => (row._proposal ? row._proposal.proposal_type_label || proposalTypeLabel(row._proposal.proposal_type) : '—') },
    { id: 'amc_it_support', header: 'AMC / IT Support', cell: (row) => formatDealSize(row._proposal?.amc_it_support, row._proposal?.amc_currency || row._proposal?.currency) },
    { id: 'closure_date', header: 'Closure Date', cell: (row) => formatDate(row._proposal?.closure_date) },
    { id: 'owner', header: 'Owner', cell: (row) => row._proposal?.owner_name || row.owner_name || '—' },
    ...recordTimestampColumns(),
  ], []);

  const groupAccountRows = useCallback((tableRows) => groupAccountProposalRows(tableRows).map((group) => {
    const a = group.account;
    const details = [a.industry, a.billing_city || a.city, a.website ? a.website.replace('https://', '') : '', a.email].filter(Boolean);
    const count = group.proposals.length;
    return {
      key: group.key,
      records: group.records,
      header: (
        <div className="flex items-center gap-3 min-w-0">
          <div className={avatarInitialClass(a.name, 'md')} aria-hidden="true">{(a.name || '?')[0]}</div>
          <div className="min-w-0">
            <RecordDetailLink href={`/accounts/${a.id}`} className="text-sm font-semibold text-zoho-text hover:text-brand-600">
              {a.name}
            </RecordDetailLink>
            {details.length > 0 && (
              <p className="text-xs text-zoho-muted truncate">{details.join(' · ')}</p>
            )}
          </div>
          <div className="ml-auto flex items-center gap-4 shrink-0 text-xs">
            {a.account_type && <Badge label={a.account_type} />}
            <span className="text-zoho-muted">
              {`${count} proposal${count === 1 ? '' : 's'}`}
              {count > 0 && (
                <>
                  <span className="mx-1.5">·</span>
                  <span className="font-medium text-zoho-text">
                    {formatMoneyTotalsByCurrency(group.proposals, { amountKey: 'deal_size', currencyKey: 'currency' })}
                  </span>
                </>
              )}
            </span>
          </div>
        </div>
      ),
    };
  }), []);

  const statusOptions = ACCOUNT_STATUS_OPTIONS;

  const updateFilter = (key, value) => {
    setFilters((current) => ({ ...current, [key]: value }));
    setPage(1);
  };

  return (
    <CRMLayout>
      <div className="p-6">
        <ListPageHeader
          title="Accounts"
          primaryAction={canCreate ? (
            <button type="button" onClick={() => navigateToRecord('/accounts/create')} className="btn-primary-sm">
              Create Account
            </button>
          ) : null}
        />

        <ListSearchBar
          search={search}
          onSearchChange={(v) => { setSearch(v); setPage(1); }}
          placeholder="Search accounts…"
          total={total}
          totalLabel="accounts"
          sort={sort}
          onSortChange={(v) => { setSort(v); setPage(1); }}
          filterTitle="Filter Accounts by"
          hasActiveFilters={countActiveFilters(filters, user) > 0}
          onClearFilters={() => { clearFilters(); setPage(1); }}
          filterFields={(
            <>
              <SelectFilter label="Industry" value={filters.industry} onChange={(v) => updateFilter('industry', v)} options={industryOptions} emptyLabel="All industries" />
              <TextFilter label="Website" value={filters.website} onChange={(v) => updateFilter('website', v)} />
              <TextFilter label="Email" value={filters.email} onChange={(v) => updateFilter('email', v)} />
              <SelectFilter label="Status" value={filters.status} onChange={(v) => updateFilter('status', v)} options={statusOptions} emptyLabel="All statuses" />
              <TextFilter label="City" value={filters.city} onChange={(v) => updateFilter('city', v)} />
              <OwnerFilter users={users} value={filters.owner_id} onChange={(v) => updateFilter('owner_id', v)} />
              <CampaignFilter campaigns={campaigns} value={filters.campaign_id} onChange={(v) => updateFilter('campaign_id', v)} />
              <CreatedUpdatedDateFilters filters={filters} onChange={updateFilter} />
            </>
          )}
          table={(
            <RecordDataTable
              moduleKey="accounts"
              records={rows}
              loading={loading}
              columns={columns}
              statusOptions={ACCOUNT_STATUS_OPTIONS}
              onRefresh={fetchAccounts}
              emptyMessage="No accounts found"
              groupRows={groupAccountRows}
              sort={sort}
              onSortChange={(v) => { setSort(v); setPage(1); }}
              {...tableSelection}
              pagination={{ page, totalPages, onPageChange: setPage, label: `Page ${page} of ${totalPages}` }}
            />
          )}
        />
      </div>
    </CRMLayout>
  );
}
