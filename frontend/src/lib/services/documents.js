import api from '../api.js';
import { assigneeName, listResult, omitEmpty } from '../activityHelpers.js';

export function normalizeDocument(doc) {
  return {
    ...doc,
    name: doc.document_name,
    file_type: doc.mime_type,
    owner_name: assigneeName(doc),
  };
}

export async function listDocuments(params = {}) {
  const res = await api.get('/documents', { params });
  const result = listResult(res);
  return { ...result, data: result.data.map(normalizeDocument) };
}

export async function getDocument(id) {
  const res = await api.get(`/documents/${id}`);
  return normalizeDocument(res.data.data);
}

export async function uploadDocument({ file, document_name, related_entity_type, related_entity_id, description, folder, owner_id }) {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('document_name', document_name);
  formData.append('related_entity_type', related_entity_type);
  formData.append('related_entity_id', related_entity_id);
  if (description) formData.append('description', description);
  if (folder) formData.append('folder', folder);
  if (owner_id) formData.append('owner_id', owner_id);

  const res = await api.post('/documents', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return normalizeDocument(res.data.data);
}

export async function updateDocument(id, form) {
  const res = await api.patch(`/documents/${id}`, omitEmpty({
    document_name: form.name ?? form.document_name,
    description: form.description,
    folder: form.folder,
  }));
  return normalizeDocument(res.data.data);
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
