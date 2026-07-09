import api from '../api.js';
import { assigneeName } from '../activityHelpers.js';
import { DEFAULT_PAGE_SIZE } from '../constants.js';

export function normalizeDocument(doc) {
  return {
    ...doc,
    name: doc.name ?? doc.document_name,
    document_name: doc.document_name ?? doc.name,
    file_type: doc.file_type ?? doc.mime_type,
    owner_name: assigneeName(doc) || doc.owner_name,
  };
}

export async function listDocuments(params = {}) {
  const { page_size, limit, ...rest } = params;
  const res = await api.get('/documents', { params: { ...rest, limit: limit ?? page_size ?? DEFAULT_PAGE_SIZE } });
  const data = res.data.data || [];
  const total = res.data.meta?.total ?? res.data.total ?? data.length;
  return {
    data: data.map(normalizeDocument),
    total,
    meta: res.data.meta || { total, page: res.data.page, limit: res.data.limit },
  };
}

export async function getDocument(id) {
  let page = 1;
  while (page <= 50) {
    const result = await listDocuments({ page, limit: DEFAULT_PAGE_SIZE });
    const doc = result.data.find((item) => String(item.id) === String(id));
    if (doc) return doc;
    if (result.data.length < DEFAULT_PAGE_SIZE || page * DEFAULT_PAGE_SIZE >= result.total) break;
    page += 1;
  }
  throw new Error('Document not found');
}

export async function uploadDocument({ file, document_name, name, related_entity_type, related_entity_id, related_type, related_id, description, folder, owner_id }) {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('name', name ?? document_name ?? file.name);
  formData.append('related_type', related_type ?? related_entity_type ?? '');
  formData.append('related_id', related_id ?? related_entity_id ?? '');
  if (description) formData.append('description', description);
  if (folder) formData.append('folder', folder);
  if (owner_id) formData.append('owner_id', owner_id);

  const res = await api.post('/documents', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return normalizeDocument(res.data.data ?? res.data);
}

export async function updateDocument(id, form) {
  throw new Error('Document metadata updates are not supported by the API');
}

export async function deleteDocument(id) {
  await api.delete(`/documents/${id}`);
}

export async function downloadDocument(id, fileName) {
  const res = await api.get(`/documents/${id}/download`, { responseType: 'blob' });
  const blob = new Blob([res.data]);
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName || `document-${id}`;
  link.click();
  URL.revokeObjectURL(url);
}
