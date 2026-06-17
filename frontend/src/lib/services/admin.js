import api from '../api.js';
import {
  LEAD_STATUS_CATEGORY,
  LEAD_STATUS_CATEGORY_CANDIDATES,
  buildLookupOptionPayload,
  normalizeLookupOption,
} from '../statusHelpers.js';

export { LEAD_STATUS_CATEGORY };

let resolvedLeadStatusCategory = null;

export async function resolveLeadStatusCategory() {
  if (resolvedLeadStatusCategory) return resolvedLeadStatusCategory;

  try {
    const categories = await listLookupCategories();
    const match = categories.find((c) =>
      LEAD_STATUS_CATEGORY_CANDIDATES.includes(c.category)
      || /lead.?status/i.test(c.category || '')
      || /lead.?status/i.test(c.label || ''),
    );
    if (match?.category) {
      resolvedLeadStatusCategory = match.category;
      return resolvedLeadStatusCategory;
    }
  } catch {
    /* fall through to probe */
  }

  for (const category of LEAD_STATUS_CATEGORY_CANDIDATES) {
    try {
      const res = await api.get(`/admin/lookup-options/${encodeURIComponent(category)}`);
      if (res.data?.data) {
        resolvedLeadStatusCategory = category;
        return category;
      }
    } catch (err) {
      if (err.response?.status !== 404) throw err;
    }
  }

  resolvedLeadStatusCategory = LEAD_STATUS_CATEGORY;
  return resolvedLeadStatusCategory;
}

export async function listAdminUsers() {
  const res = await api.get('/admin/users');
  return res.data.data || [];
}

export async function getAdminUser(id) {
  const res = await api.get(`/admin/users/${id}`);
  return res.data.data;
}

export async function createAdminUser(payload) {
  const res = await api.post('/admin/users', payload);
  return res.data.data;
}

export async function updateAdminUser(id, payload) {
  const res = await api.patch(`/admin/users/${id}`, payload);
  return res.data.data;
}

export async function getAdminSettings() {
  const res = await api.get('/admin/settings');
  return res.data.data;
}

export async function updateAppSettings(payload) {
  const res = await api.patch('/admin/settings/app', payload);
  return res.data.data;
}

export async function updateWeeklyReportSettings(payload) {
  const res = await api.patch('/admin/settings/weekly-report', payload);
  return res.data.data;
}

export async function listLookupCategories() {
  const res = await api.get('/admin/lookup-options');
  return res.data.data || [];
}

export async function getLookupCategory(category) {
  const res = await api.get(`/admin/lookup-options/${encodeURIComponent(category)}`);
  return res.data.data;
}

export async function createLookupOption(category, payload) {
  const res = await api.post(`/admin/lookup-options/${encodeURIComponent(category)}`, payload);
  return res.data.data;
}

export async function updateLookupOption(category, optionId, payload) {
  const res = await api.patch(`/admin/lookup-options/${encodeURIComponent(category)}/${optionId}`, payload);
  return res.data.data;
}

export async function deleteLookupOption(category, optionId) {
  await api.delete(`/admin/lookup-options/${encodeURIComponent(category)}/${optionId}`);
}

export async function syncLookupDefaults() {
  const res = await api.post('/admin/lookup-options/sync-defaults');
  return res.data.data;
}

/** Lead status admin helpers — backed by lookup-options API */
export async function listAdminLeadStatuses() {
  const category = await resolveLeadStatusCategory();
  const data = await getLookupCategory(category);
  return (data?.options || []).map(normalizeLookupOption);
}

export async function createAdminLeadStatus({ label, value, sort_order, is_active = true }) {
  const category = await resolveLeadStatusCategory();
  const payload = buildLookupOptionPayload({ label, value, sort_order, is_active });
  const created = await createLookupOption(category, payload);
  return normalizeLookupOption(created);
}

export async function deleteAdminLeadStatus(optionId) {
  const category = await resolveLeadStatusCategory();
  await deleteLookupOption(category, optionId);
}

export async function updateAdminLeadStatus(optionId, payload) {
  const category = await resolveLeadStatusCategory();
  const updated = await updateLookupOption(category, optionId, payload);
  return normalizeLookupOption(updated);
}
