import api from '../api.js';

export function normalizeRecycleItem(item) {
  return {
    ...item,
    record_type: item.entity_type,
    name: item.entity_name,
  };
}

export async function listRecycleBin({ page = 1, page_size = 20, entity_type } = {}) {
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
  return res.data;
}
