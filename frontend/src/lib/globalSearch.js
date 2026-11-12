import api from './api.js';
import * as campaignsApi from './services/campaigns.js';
import * as sequencesApi from './services/sequences.js';
import * as documentsApi from './services/documents.js';
import * as meetingsApi from './services/meetings.js';
import * as tasksApi from './services/tasks.js';
import { NAV_MODULES, QUICK_CREATE } from './constants.js';
import { getLeadDetailPath, pipelineStageLabel, resolveLeadPipelineStage } from './pipelineHelpers.js';
import { companyDetailHref, sequenceDetailHref } from './recordNavigation.js';
import { detectRecordModule, normalizeCompany } from './companyHelpers.js';
import { normalizeContact } from './contactHelpers.js';
import { normalizeLead } from './leadHelpers.js';
import { normalizeAccount } from './accountHelpers.js';
import { normalizeDeal } from './dealHelpers.js';
import {
  resolveListSearch, matchesSearchTokens, personSearchHaystack, genericSearchHaystack,
} from './listSearchHelpers.js';

const fullName = (r) => `${r.first_name || ''} ${r.last_name || ''}`.trim();
const joinSub = (...parts) => parts.filter(Boolean).join(' · ');
const rowsOf = (res) => res?.data?.data ?? res?.data ?? [];

/** One page from an endpoint (the search list functions can download everything for multi-word queries). */
async function getPage(url, apiSearch, size, extra = {}) {
  const res = await api.get(url, { params: { search: apiSearch, page: 1, page_size: size, ...extra } });
  return rowsOf(res);
}

/**
 * Record types the header search looks in, in display order. Requests go out in this order too:
 * the API answers one request at a time, so the most-used types come first.
 * Each source is only searched when the user can view that module.
 * fetch(apiSearch, size) makes exactly one request; extra words are matched on the rows it returns.
 */
export const GLOBAL_SEARCH_SOURCES = [
  {
    key: 'contacts', label: 'Contacts', permissionKey: 'contacts', limit: 5,
    fetch: async (s, n) => (await getPage('/contacts', s, n)).map((c) => normalizeContact(c)),
    haystack: personSearchHaystack,
    toResult: (c) => ({
      id: c.id, name: fullName(c) || c.email || 'Contact', sub: joinSub(c.email, c.account_name), href: `/contacts/${c.id}`,
    }),
  },
  {
    key: 'leads', label: 'Leads', permissionKeys: ['raw_leads', 'leads', 'qualified_leads', 'proposals'], limit: 5,
    fetch: async (s, n) => (await getPage('/leads', s, n, { is_converted: false })).map((l) => normalizeLead(l)),
    haystack: personSearchHaystack,
    toResult: (l) => ({
      id: l.id,
      name: fullName(l) || l.email || 'Lead',
      sub: joinSub(pipelineStageLabel(resolveLeadPipelineStage(l)), l.company, l.email),
      href: getLeadDetailPath(l, l.id),
    }),
  },
  {
    key: 'accounts', label: 'Accounts', permissionKey: 'accounts', limit: 4,
    fetch: async (s, n) => (await getPage('/accounts', s, n)).map((a) => normalizeAccount(a)),
    haystack: (a) => genericSearchHaystack(a, ['industry', 'website', 'city']),
    toResult: (a) => ({ id: a.id, name: a.name || 'Account', sub: joinSub(a.industry, a.city), href: `/accounts/${a.id}` }),
  },
  {
    key: 'companies', label: 'Companies', permissionKey: 'companies', limit: 4,
    // /companies also returns rows moved to Accounts; drop those.
    fetch: async (s, n) => (await getPage('/companies', s, n))
      .filter((row) => detectRecordModule(row) !== 'account')
      .map((c) => normalizeCompany(c)),
    haystack: (c) => genericSearchHaystack(c, ['industry', 'website', 'city']),
    toResult: (c) => ({ id: c.id, name: c.name || 'Company', sub: joinSub(c.industry, c.city), href: companyDetailHref(c.id) }),
  },
  {
    key: 'deals', label: 'Deals', permissionKey: 'deals', limit: 3,
    fetch: async (s, n) => (await getPage('/deals', s, n)).map((d) => normalizeDeal(d)),
    haystack: (d) => genericSearchHaystack(d, ['deal_name']),
    toResult: (d) => ({ id: d.id, name: d.name || d.deal_name || 'Deal', sub: joinSub(d.account_name, d.stage_label), href: `/deals/${d.id}` }),
  },
  {
    key: 'campaigns', label: 'Campaigns', permissionKey: 'campaigns', limit: 3,
    fetch: async (s, n) => (await campaignsApi.listCampaigns({ search: s, page: 1, page_size: n })).data,
    haystack: (c) => genericSearchHaystack(c, ['type']),
    toResult: (c) => ({ id: c.id, name: c.name || 'Campaign', sub: joinSub(c.status_label || c.status, c.type), href: `/campaigns/${c.id}` }),
  },
  {
    key: 'sequences', label: 'Sequences', permissionKey: 'sequences', limit: 3,
    fetch: async (s, n) => (await sequencesApi.listSequences({ search: s, page: 1, page_size: n })).data,
    haystack: (r) => genericSearchHaystack(r),
    toResult: (r) => ({ id: r.id, name: r.name || 'Sequence', sub: r.status_label || r.status || '', href: sequenceDetailHref(r.id) }),
  },
  {
    key: 'documents', label: 'Documents', permissionKey: 'documents', limit: 3,
    fetch: async (s, n) => (await documentsApi.listDocuments({ search: s, page: 1, page_size: n })).data,
    haystack: (d) => genericSearchHaystack(d, ['file_name', 'related_name']),
    toResult: (d) => ({ id: d.id, name: d.name || d.file_name || d.title || 'Document', sub: d.related_name || '', href: `/documents/${d.id}` }),
  },
  {
    key: 'meetings', label: 'Meetings', permissionKey: 'meetings', limit: 3,
    fetch: async (s, n) => (await meetingsApi.listMeetings({ search: s, page: 1, page_size: n })).data,
    haystack: (m) => genericSearchHaystack(m),
    toResult: (m) => ({
      id: m.id, name: m.title || 'Meeting', sub: m.start_time ? new Date(m.start_time).toLocaleString() : '', href: `/meetings/${m.id}`,
    }),
  },
  {
    key: 'tasks', label: 'Tasks', permissionKey: 'tasks', limit: 3,
    fetch: async (s, n) => (await tasksApi.listTasks({ search: s, page: 1, page_size: n })).data,
    haystack: (t) => genericSearchHaystack(t, ['assigned_name']),
    toResult: (t) => ({ id: t.id, name: t.title || t.subject || 'Task', sub: t.assigned_name || '', href: `/tasks/${t.id}` }),
  },
];

function canSearchSource(source, can) {
  if (typeof can !== 'function') return true;
  const keys = source.permissionKeys || [source.permissionKey];
  return keys.some((key) => can(key, 'view'));
}

/** Search sources the user is allowed to see. */
export function visibleSearchSources(can) {
  return GLOBAL_SEARCH_SOURCES.filter((source) => canSearchSource(source, can));
}

/** Pages and quick actions whose name matches the query ("reports", "create contact"…). No request. */
export function matchPagesAndActions(query, can) {
  const q = String(query || '').trim().toLowerCase();
  if (!q) return [];
  const allowed = (key) => typeof can !== 'function' || !key || can(key, 'view');
  const pages = [
    ...NAV_MODULES.filter((m) => allowed(m.permissionKey))
      .map((m) => ({ id: `page:${m.href}`, name: m.label, sub: 'Go to page', href: m.href })),
    { id: 'page:/settings', name: 'Settings', sub: 'Go to page', href: '/settings' },
  ];
  const actions = QUICK_CREATE.filter((a) => typeof can !== 'function' || can(a.permissionKey, 'create'))
    .map((a) => ({ id: `create:${a.href}`, name: `Create ${a.label}`, sub: 'Quick create', href: a.href }));
  return [...pages, ...actions]
    .filter((item) => item.name.toLowerCase().includes(q))
    .slice(0, 5)
    .map((item) => ({ ...item, type: 'pages' }));
}

/**
 * Search every allowed source. `onGroup(key, label, results)` fires as each source answers, so
 * results appear progressively; a source that fails just reports no results.
 * Each source makes one request: the longest word goes to the API, and every word must match.
 */
export async function runGlobalSearch(query, { can, onGroup } = {}) {
  const { apiSearch, tokens } = resolveListSearch(query);
  if (!apiSearch) return;
  await Promise.all(visibleSearchSources(can).map(async (source) => {
    let results = [];
    try {
      // Fetch a few extra rows so multi-word queries still fill the group after matching.
      const rows = await source.fetch(apiSearch, tokens.length > 1 ? source.limit * 4 : source.limit);
      results = (rows || [])
        .filter((row) => matchesSearchTokens(row, tokens, source.haystack))
        .slice(0, source.limit)
        .map((row) => ({ ...source.toResult(row), type: source.key }));
    } catch {
      results = [];
    }
    onGroup?.(source.key, source.label, results);
  }));
}
