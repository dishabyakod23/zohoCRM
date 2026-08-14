'use client';
import { useEffect, useState, useCallback, useMemo } from 'react';
import CRMLayout from '../../components/layout/CRMLayout.js';
import ListPageHeader from '../../components/layout/ListPageHeader.js';
import ListSearchBar from '../../components/layout/ListSearchBar.js';
import RecordDataTable from '../../components/records/RecordDataTable.js';
import RecordDetailLink from '../../components/records/RecordDetailLink.js';
import { useAuth } from '../../hooks/useAuth.js';
import { useToast } from '../../components/ui/Toast.js';
import { useDebouncedValue } from '../../hooks/useDebouncedValue.js';
import { useListRefresh } from '../../hooks/useListRefresh.js';
import { getApiError } from '../../lib/api.js';
import * as companiesApi from '../../lib/services/companies.js';
import { INDUSTRIES, DEFAULT_PAGE_SIZE } from '../../lib/constants.js';
import { tableLinkClass, tableEmailClass, avatarInitialClass } from '../../lib/tableStyles.js';
import { TextFilter, SelectFilter, OwnerFilter, CampaignFilter, CreatedUpdatedDateFilters } from '../../components/layout/ListFilterFields.js';
import { recordTimestampColumns } from '../../lib/listTimestampHelpers.js';
import { fetchUsers } from '../../lib/services/lookups.js';
import { EMPTY_ACCOUNT_FILTERS, countActiveFilters } from '../../lib/listRecordFilters.js';
import { useDefaultOwnerFilters } from '../../hooks/useDefaultOwnerFilters.js';
import { DEFAULT_LIST_SORT, getSortApiParams } from '../../lib/listSortHelpers.js';
import { useCampaignLookups } from '../../hooks/useCampaignLookups.js';
import { useCampaignMemberFilter } from '../../hooks/useCampaignMemberFilter.js';
import { useTableSelection } from '../../hooks/useTableSelection.js';
import { companyDetailHref } from '../../lib/recordNavigation.js';

const LIMIT = DEFAULT_PAGE_SIZE;

export default function CompaniesPage() {
  const { showToast } = useToast();
  const { user } = useAuth();
  const [companies, setCompanies] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search);
  const [page, setPage] = useState(1);
  const { filters, setFilters, clearFilters } = useDefaultOwnerFilters(EMPTY_ACCOUNT_FILTERS);
  const [users, setUsers] = useState([]);
  const [sort, setSort] = useState(DEFAULT_LIST_SORT);
  const { campaigns } = useCampaignLookups();
  const { memberIds: campaignMemberIds, ready: campaignMembersReady } = useCampaignMemberFilter(filters.campaign_id, 'account');

  useEffect(() => {
    fetchUsers().then(setUsers).catch(() => setUsers([]));
  }, []);

  const fetchCompanies = useCallback(async () => {
    if (filters.campaign_id && !campaignMembersReady) return;

    setLoading(true);
    try {
      const result = await companiesApi.listCompanies({
        page,
        page_size: LIMIT,
        search: debouncedSearch || undefined,
        filters,
        campaignMemberIds,
        ...getSortApiParams(sort, 'companies'),
      });
      setCompanies(result.data);
      setTotal(result.total);
    } catch (err) {
      showToast(getApiError(err));
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch, filters, sort, showToast, campaignMemberIds, campaignMembersReady]);

  useEffect(() => { fetchCompanies(); }, [fetchCompanies]);
  useListRefresh(fetchCompanies);

  const totalPages = Math.ceil(total / LIMIT) || 1;

  const companyListParams = useMemo(() => ({
    search: debouncedSearch || undefined,
    filters,
    campaignMemberIds,
    ...getSortApiParams(sort, 'companies'),
  }), [debouncedSearch, filters, sort, campaignMemberIds]);

  const fetchAllMatchingCompanyIds = useCallback(
    () => companiesApi.listAllMatchingCompanyIds(companyListParams),
    [companyListParams],
  );

  const tableSelection = useTableSelection({
    total,
    resetDeps: [debouncedSearch, filters, sort, campaignMemberIds],
    fetchAllIds: fetchAllMatchingCompanyIds,
  });

  const columns = useMemo(() => [
    { id: 'name', header: 'Company', cell: (company) => (
      <div className="flex items-center gap-2.5">
        <div className={avatarInitialClass(company.name, 'md')}>{(company.name || '?')[0]}</div>
        <RecordDetailLink href={companyDetailHref(company.id)} className={tableLinkClass}>{company.name}</RecordDetailLink>
      </div>
    ) },
    { id: 'contacts', header: 'Contacts', cell: (company) => company.contact_count || 0 },
    { id: 'industry', header: 'Industry', cell: (company) => company.industry || '—' },
    { id: 'website', header: 'Website', cell: (company) => company.website ? (
      <a href={company.website} target="_blank" rel="noreferrer" className={`${tableEmailClass} text-xs hover:text-zoho-text hover:underline`}>
        {company.website.replace('https://', '')}
      </a>
    ) : '—' },
    { id: 'email', header: 'Email', sortField: 'email', cell: (company) => <span className={tableEmailClass}>{company.email || '—'}</span> },
    { id: 'city', header: 'City', cell: (company) => company.billing_city || company.city || '—' },
    { id: 'owner', header: 'Owner', cell: (company) => company.owner_name || '—' },
    ...recordTimestampColumns(),
  ], []);

  const industryOptions = INDUSTRIES.map((value) => ({ value, label: value }));

  const updateFilter = (key, value) => {
    setFilters((current) => ({ ...current, [key]: value }));
    setPage(1);
  };

  return (
    <CRMLayout>
      <div className="p-6">
        <ListPageHeader
          title="Companies"
          subtitle="Organizations linked to your contacts. Add a company when creating a contact."
        />

        <ListSearchBar
          search={search}
          onSearchChange={(v) => { setSearch(v); setPage(1); }}
          placeholder="Search companies…"
          total={total}
          totalLabel="companies"
          sort={sort}
          onSortChange={(v) => { setSort(v); setPage(1); }}
          filterTitle="Filter Companies by"
          hasActiveFilters={countActiveFilters(filters, user) > 0}
          onClearFilters={() => { clearFilters(); setPage(1); }}
          filterFields={(
            <>
              <SelectFilter label="Industry" value={filters.industry} onChange={(v) => updateFilter('industry', v)} options={industryOptions} emptyLabel="All industries" />
              <TextFilter label="Website" value={filters.website} onChange={(v) => updateFilter('website', v)} />
              <TextFilter label="Email" value={filters.email} onChange={(v) => updateFilter('email', v)} />
              <TextFilter label="City" value={filters.city} onChange={(v) => updateFilter('city', v)} />
              <OwnerFilter users={users} value={filters.owner_id} onChange={(v) => updateFilter('owner_id', v)} />
              <CampaignFilter campaigns={campaigns} value={filters.campaign_id} onChange={(v) => updateFilter('campaign_id', v)} />
              <CreatedUpdatedDateFilters filters={filters} onChange={updateFilter} />
            </>
          )}
          table={(
            <RecordDataTable
              moduleKey="companies"
              records={companies}
              loading={loading}
              columns={columns}
              onRefresh={fetchCompanies}
              emptyMessage="No companies found. Companies appear when you add contacts with a company name."
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
