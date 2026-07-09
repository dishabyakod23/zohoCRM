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

export async function listRecycleBin({ page = 1, page_size = DEFAULT_PAGE_SIZE, entity_type } = {}) {
  const params = { page, page_size };
  if (entity_type) params.entity_type = entity_type;
  const res = await api.get('/recycle-bin', { params });
  return {
    data: (res.data.data || []).map(normalizeRecycleItem),
    total: res.data.meta?.total ?? 0,
    meta: res.data.meta,
  };
}

export async function restoreRecycleItem(recycleId) {
  const res = await api.post(`/recycle-bin/${recycleId}/restore`);
  return res.data?.data || res.data;
}

export async function deleteRecycleItem(recycleId) {
  const res = await api.delete(`/recycle-bin/${recycleId}`);
  return res.data?.data || res.data;
}
