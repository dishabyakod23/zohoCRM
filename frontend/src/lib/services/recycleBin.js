import api from '../api.js';
import { formatEnumLabel } from '../activityHelpers.js';
import { DEFAULT_PAGE_SIZE } from '../constants.js';

export const RECYCLE_ENTITY_TYPES = [
  { value: '', label: 'All types' },
  { value: 'lead', label: 'Lead' },
  { value: 'contact', label: 'Contact' },
  { value: 'account', label: 'Account' },
  { value: 'deal', label: 'Deal' },
  { value: 'task', label: 'Task' },
  { value: 'meeting', label: 'Meeting' },
  { value: 'call', label: 'Call' },
  { value: 'campaign', label: 'Campaign' },
  { value: 'visit', label: 'Visit' },
  { value: 'project', label: 'Project' },
  { value: 'document', label: 'Document' },
];

export function normalizeRecycleItem(item) {
  if (!item) return item;
  const entityType = item.entity_type || item.record_type;
  return {
    ...item,
    id: item._composite_id || item.id,
    entity_type: entityType,
    entity_type_label: formatEnumLabel(entityType),
    entity_name: item.entity_name || '—',
    name: item.entity_name || '—',
    record_type: entityType,
  };
}

export async function listRecycleBin({ page = 1, page_size = DEFAULT_PAGE_SIZE, entity_type, sort_by, sort_order } = {}) {
  const params = { page, page_size };
  if (entity_type) params.entity_type = entity_type;
  if (sort_by) params.sort_by = sort_by;
  if (sort_order) params.sort_order = sort_order;
  const res = await api.get('/recycle-bin', { params });
  return {
    data: (res.data.data || []).map(normalizeRecycleItem),
    total: res.data.meta?.total ?? 0,
    meta: res.data.meta,
  };
}

/** Load every recycle-bin row (for reliable client-side name sorting). */
export async function listAllRecycleBin({ entity_type, page_size = 200 } = {}) {
  const all = [];
  let page = 1;
  let total = Infinity;

  while (all.length < total) {
    const result = await listRecycleBin({
      page,
      page_size,
      entity_type: entity_type || undefined,
      sort_by: 'deleted_at',
      sort_order: 'desc',
    });
    const batch = result.data || [];
    total = result.total ?? batch.length;
    all.push(...batch);
    if (!batch.length || batch.length < page_size) break;
    page += 1;
    if (page > 100) break;
  }

  return { data: all, total: all.length };
}

export async function restoreRecycleItem(recycleId) {
  const res = await api.post(`/recycle-bin/${recycleId}/restore`);
  const payload = res.data?.data || res.data || {};
  // Normalize conflict / skip shapes so the UI can show a warning instead of false success.
  if (
    payload.restored === false
    || payload.success === false
    || payload.conflict
    || payload.duplicate
    || payload.skipped
  ) {
    return {
      ...payload,
      restored: false,
      message: payload.message
        || payload.error
        || payload.detail
        || 'Could not restore — a matching record may already exist.',
    };
  }
  return payload;
}

export async function deleteRecycleItem(recycleId) {
  const res = await api.delete(`/recycle-bin/${recycleId}`);
  return res.data?.data || res.data;
}
