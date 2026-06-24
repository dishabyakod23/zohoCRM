import api from '../api.js';
import { normalizeDeal, toDealPayload } from '../dealHelpers.js';

const LIST_PAGE_SIZE_MAX = 100;

export async function listDeals({ page = 1, page_size = 50, search, stage, account_id, owner_id, sort_by, sort_order } = {}, accountMap = {}, stageOptions = []) {
  const cappedSize = Math.min(page_size, LIST_PAGE_SIZE_MAX);
  const params = { page, page_size: cappedSize };
  if (search) params.search = search;
  if (stage) params.stage = stage;
  if (account_id) params.account_id = account_id;
  if (owner_id) params.owner_id = owner_id;
  if (sort_by) params.sort_by = sort_by;
  if (sort_order) params.sort_order = sort_order;

  const res = await api.get('/deals', { params });
  return {
    data: (res.data.data || []).map(d => normalizeDeal(d, accountMap, stageOptions)),
    total: res.data.meta?.total ?? 0,
    meta: res.data.meta,
  };
}

/** Fetch all deals by paging with API-safe page_size (for kanban / related lists). */
export async function listAllDeals(params = {}, accountMap = {}, stageOptions = []) {
  const pageSize = LIST_PAGE_SIZE_MAX;
  let page = 1;
  const all = [];
  let total = 0;

  for (;;) {
    const result = await listDeals({ ...params, page, page_size: pageSize }, accountMap, stageOptions);
    all.push(...result.data);
    total = result.total || all.length;
    if (result.data.length < pageSize || all.length >= total) break;
    page += 1;
  }

  return { data: all, total };
}

export async function getDeal(id, accountMap = {}, stageOptions = []) {
  const res = await api.get(`/deals/${id}`);
  return normalizeDeal(res.data.data, accountMap, stageOptions);
}

export async function createDeal(form) {
  const res = await api.post('/deals', toDealPayload(form));
  return normalizeDeal(res.data.data);
}

export async function updateDeal(id, form) {
  const res = await api.patch(`/deals/${id}`, toDealPayload(form, { partial: true }));
  return normalizeDeal(res.data.data);
}

export async function deleteDeal(id) {
  await api.delete(`/deals/${id}`);
}

export async function reopenDealAsLead(id) {
  const res = await api.post(`/deals/${id}/reopen-as-lead`);
  return res.data.data;
}
