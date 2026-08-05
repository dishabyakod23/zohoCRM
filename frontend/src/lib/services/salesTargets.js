import api from '../api.js';
import { DEFAULT_PAGE_SIZE } from '../constants.js';
import {
  buildSalesTargetListParams,
  buildSalesTargetReportParams,
  normalizeSalesTarget,
  normalizeSalesTargetDashboard,
  normalizeSalesTargetReportRow,
  normalizeSalesTargetSettings,
  toSalesTargetCopyPayload,
  toSalesTargetPayload,
  toSalesTargetReportRemarkPayload,
  toSalesTargetRollupPayload,
  toSalesTargetSettingsPayload,
  toSalesTargetUpdatePayload,
} from '../salesTargetHelpers.js';

const BASE = '/sales-targets';

export async function getSalesTargetSettings() {
  const res = await api.get(`${BASE}/settings`);
  return normalizeSalesTargetSettings(res.data.data);
}

export async function updateSalesTargetSettings(form) {
  const res = await api.patch(`${BASE}/settings`, toSalesTargetSettingsPayload(form));
  return normalizeSalesTargetSettings(res.data.data);
}

export async function listSalesTargets(params = {}) {
  const res = await api.get(BASE, { params: buildSalesTargetListParams(params) });
  return {
    data: (res.data.data || []).map(normalizeSalesTarget),
    total: res.data.meta?.total ?? 0,
    meta: res.data.meta,
  };
}

export async function getSalesTarget(targetId) {
  const res = await api.get(`${BASE}/${targetId}`);
  return normalizeSalesTarget(res.data.data);
}

export async function createSalesTarget(form) {
  const res = await api.post(BASE, toSalesTargetPayload(form));
  return normalizeSalesTarget(res.data.data);
}

export async function updateSalesTarget(targetId, form) {
  const res = await api.patch(`${BASE}/${targetId}`, toSalesTargetUpdatePayload(form));
  return normalizeSalesTarget(res.data.data);
}

export async function deleteSalesTarget(targetId) {
  await api.delete(`${BASE}/${targetId}`);
}

export async function lockSalesTarget(targetId, { reason } = {}) {
  const res = await api.post(`${BASE}/${targetId}/lock`, reason ? { reason } : {});
  return normalizeSalesTarget(res.data.data);
}

export async function unlockSalesTarget(targetId, { reason } = {}) {
  const res = await api.post(`${BASE}/${targetId}/unlock`, reason ? { reason } : {});
  return normalizeSalesTarget(res.data.data);
}

export async function copySalesTarget(form) {
  const res = await api.post(`${BASE}/copy`, toSalesTargetCopyPayload(form));
  return normalizeSalesTarget(res.data.data);
}

export async function rollupSalesTarget(form) {
  const res = await api.post(`${BASE}/rollup`, toSalesTargetRollupPayload(form));
  return normalizeSalesTarget(res.data.data);
}

export async function addSalesTargetReportRemark(form) {
  const res = await api.post(`${BASE}/report-remarks`, toSalesTargetReportRemarkPayload(form));
  return res.data.data;
}

export async function getSalesTargetPerformanceReport(params = {}) {
  const res = await api.get(`${BASE}/reports/performance`, {
    params: buildSalesTargetReportParams(params),
  });
  return (res.data.data || []).map(normalizeSalesTargetReportRow);
}

export async function exportSalesTargetPerformanceReport(params = {}) {
  const res = await api.get(`${BASE}/reports/performance/export`, {
    params: buildSalesTargetReportParams(params),
    responseType: 'blob',
  });
  return res.data;
}

export async function getSalesTargetDashboard() {
  const res = await api.get(`${BASE}/dashboard`);
  return normalizeSalesTargetDashboard(res.data.data);
}

export async function listAllSalesTargets(params = {}) {
  const pageSize = DEFAULT_PAGE_SIZE;
  let page = 1;
  const all = [];
  let total = 0;

  for (;;) {
    const result = await listSalesTargets({ ...params, page, page_size: pageSize });
    all.push(...result.data);
    total = result.total || all.length;
    if (result.data.length < pageSize || all.length >= total) break;
    page += 1;
  }

  return { data: all, total };
}
