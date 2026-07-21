import api from '../api.js';
import { normalizeContact, toContactPayload } from '../contactHelpers.js';
import { downloadBlob, normalizeImportResult } from '../importHelpers.js';
import {
  applyContactRecordFilters,
  hasContactClientFilters,
} from '../listRecordFilters.js';
import { CONTACT_IMPORT_FIELDS } from '../importFieldConfig.js';
import { DEFAULT_PAGE_SIZE } from '../constants.js';

async function fetchAllContactPages(params, accountMap) {
  const pageSize = DEFAULT_PAGE_SIZE;
  let page = 1;
  let all = [];
  let serverTotal = 0;

  while (page <= 50) {
    const res = await api.get('/contacts', { params: { ...params, page, page_size: pageSize } });
    const batch = (res.data.data || []).map((c) => normalizeContact(c, accountMap));
    serverTotal = res.data.meta?.total ?? all.length + batch.length;
    all = all.concat(batch);
    if (batch.length === 0 || all.length >= serverTotal) break;
    page += 1;
  }

  return all;
}

export async function listAllContacts(params = {}, accountMap = {}) {
  const data = await fetchAllContactPages(params, accountMap);
  return { data, total: data.length };
}

export async function listContacts({
  page = 1,
  page_size = DEFAULT_PAGE_SIZE,
  search,
  account_id,
  owner_id,
  sort_by,
  sort_order,
  filters = {},
} = {}, accountMap = {}) {
  const params = { page, page_size };
  if (search) params.search = search;
  if (account_id) params.account_id = account_id;
  const mergedOwnerId = filters.owner_id || owner_id;
  if (mergedOwnerId) params.owner_id = mergedOwnerId;
  if (sort_by) params.sort_by = sort_by;
  if (sort_order) params.sort_order = sort_order;

  if (hasContactClientFilters(filters)) {
    const allContacts = await fetchAllContactPages(
      { search, owner_id: mergedOwnerId, sort_by, sort_order },
      accountMap,
    );
    const filtered = applyContactRecordFilters(allContacts, filters);
    const start = (page - 1) * page_size;
    return {
      data: filtered.slice(start, start + page_size),
      total: filtered.length,
      meta: { total: filtered.length },
    };
  }

  const res = await api.get('/contacts', { params });
  return {
    data: (res.data.data || []).map(c => normalizeContact(c, accountMap)),
    total: res.data.meta?.total ?? 0,
    meta: res.data.meta,
  };
}

export async function getContact(id, accountMap = {}) {
  const res = await api.get(`/contacts/${id}`);
  return normalizeContact(res.data.data, accountMap);
}

export async function createContact(form) {
  const res = await api.post('/contacts', toContactPayload(form));
  return normalizeContact(res.data.data);
}

export async function updateContact(id, form) {
  const res = await api.patch(`/contacts/${id}`, toContactPayload(form, { partial: true }));
  return normalizeContact(res.data.data);
}

export async function deleteContact(id) {
  await api.delete(`/contacts/${id}`);
}

export async function downloadContactImportTemplate() {
  const headers = CONTACT_IMPORT_FIELDS.map((f) => f.key);
  const csv = `${headers.join(',')}\n`;
  downloadBlob(new Blob([csv], { type: 'text/csv' }), 'contacts-import-template.csv');
}

function coerceImportBool(value) {
  if (value == null || value === '') return false;
  const v = String(value).trim().toLowerCase();
  return ['1', 'true', 'yes', 'y', 'on'].includes(v);
}

export async function importContactsFile(file, { dry_run = true } = {}) {
  const csv = await file.text();
  const upload = await api.post('/contacts/bulk-upload', { csv });
  const payload = upload.data.data || {};
  const readyRecords = payload.readyRecords || [];
  if (dry_run) {
    return normalizeImportResult({
      ready_count: payload.ready,
      error_count: payload.errors,
      errorRecords: (payload.errorRecords || []).map((e) => ({ row: e.row, message: e.error })),
      readyRecords,
    });
  }

  let accounts = [];
  try {
    const { fetchAccountLookups } = await import('./lookups.js');
    accounts = await fetchAccountLookups();
  } catch {
    accounts = [];
  }

  let imported = 0;
  for (const record of readyRecords) {
    let accountId = record.account_id || null;
    if (!accountId && (record.account_name || record.account || record.company)) {
      const { resolveContactAccountId } = await import('../resolveContactAccount.js');
      accountId = await resolveContactAccountId({
        account_id: record.account_id,
        account_name: record.account_name || record.account || record.company,
        accounts,
        phone: record.phone,
        mobile: record.mobile,
        owner_id: record.owner_id || null,
      });
    }

    const form = {
      ...record,
      account_id: accountId,
      email_opt_out: coerceImportBool(record.email_opt_out),
      skype_id: record.skype_id || record.linkedin || null,
    };
    await api.post('/contacts', toContactPayload(form));
    imported += 1;
  }
  return normalizeImportResult({ imported_count: imported });
}

export async function convertToRawLead(contactId) {
  return convertContact(contactId, 'raw_prospect');
}

const CONTACT_CONVERT_ENDPOINTS = {
  raw_prospect: 'convert-to-raw-lead',
  contacted: 'convert-to-lead',
  qualified_lead: 'convert-to-qualified-lead',
  proposal: 'convert-to-proposal',
};

export async function convertContact(contactId, target = 'raw_prospect') {
  const endpoint = CONTACT_CONVERT_ENDPOINTS[target] || CONTACT_CONVERT_ENDPOINTS.raw_prospect;
  const res = await api.post(`/contacts/${contactId}/${endpoint}`);
  return res.data?.data || null;
}
