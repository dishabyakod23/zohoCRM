import api from '../api.js';
import { cachedRequest, invalidateCachedRequest } from '../requestCache.js';
import { invalidateLookup } from '../lookupCache.js';
import {
  LEAD_STATUS_CATEGORY,
  LEAD_STATUS_CATEGORY_CANDIDATES,
  buildLookupOptionPayload,
  normalizeLookupOption,
  DND_LEAD_STATUS,
  isDndStatus,
  pickRegisteredDndValue,
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

export async function listAdminUsers({ sort_by = 'created_at', sort_order = 'desc' } = {}) {
  const res = await api.get('/admin/users', { params: { sort_by, sort_order } });
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

export async function getAdminSettings({ fresh = false } = {}) {
  if (fresh) invalidateCachedRequest('admin:settings');
  return cachedRequest('admin:settings', async () => {
    const res = await api.get('/admin/settings');
    return res.data.data;
  }, 2 * 60 * 1000);
}

export async function updateAppSettings(payload) {
  const res = await api.patch('/admin/settings/app', payload);
  invalidateCachedRequest('admin:settings');
  return res.data.data;
}

export async function updateWeeklyReportSettings(payload) {
  const res = await api.patch('/admin/settings/weekly-report', payload);
  invalidateCachedRequest('admin:settings');
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
  invalidateLookup('lead-statuses');
  return normalizeLookupOption(created);
}

export async function deleteAdminLeadStatus(optionId) {
  const category = await resolveLeadStatusCategory();
  await deleteLookupOption(category, optionId);
  invalidateLookup('lead-statuses');
}

export async function updateAdminLeadStatus(optionId, payload) {
  const category = await resolveLeadStatusCategory();
  const updated = await updateLookupOption(category, optionId, payload);
  invalidateLookup('lead-statuses');
  return normalizeLookupOption(updated);
}

let dndRegisterPromise = null;
let registeredDndValue = null;

async function createDndLookupOption() {
  try {
    return await createAdminLeadStatus({ label: 'DND', value: DND_LEAD_STATUS });
  } catch (err) {
    if (err?.response?.status === 422 || err?.response?.status === 409) {
      return createAdminLeadStatus({ label: 'DND', value: 'do_not_disturb' });
    }
    throw err;
  }
}

/**
 * Create DND in admin lead-status lookups if missing so mass-update/PATCH accept it.
 * Returns the API value to send, or null if the current user cannot register it.
 */
export async function ensureDndLeadStatusRegistered() {
  if (registeredDndValue) return registeredDndValue;
  if (dndRegisterPromise) return dndRegisterPromise;

  dndRegisterPromise = (async () => {
    try {
      const rows = await listAdminLeadStatuses();
      const existing = (rows || []).find((row) => isDndStatus(row.value) || isDndStatus(row.label));
      if (existing?.value) {
        if (existing.is_active === false && existing.id) {
          await updateAdminLeadStatus(existing.id, { is_active: true });
        }
        registeredDndValue = String(existing.value);
        return registeredDndValue;
      }
    } catch {
      /* try create anyway — some roles can add options without listing */
    }

    try {
      const created = await createDndLookupOption();
      const value = pickRegisteredDndValue([created]) || created?.value || DND_LEAD_STATUS;
      registeredDndValue = String(value);
      return registeredDndValue;
    } catch (err) {
      if (err?.response?.status === 409) {
        try {
          const rows = await listAdminLeadStatuses();
          const value = pickRegisteredDndValue(rows);
          if (value) {
            registeredDndValue = value;
            return registeredDndValue;
          }
        } catch {
          /* fall through */
        }
        registeredDndValue = DND_LEAD_STATUS;
        return registeredDndValue;
      }
      dndRegisterPromise = null;
      return null;
    }
  })();

  return dndRegisterPromise;
}
