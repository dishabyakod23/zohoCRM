import api from '../api.js';
import { ownerName } from '../recordHelpers.js';
import { userDisplayName } from '../userHelpers.js';
import { fetchUsers } from './lookups.js';
import { DEFAULT_PAGE_SIZE } from '../constants.js';
import { fetchAllIdsFromEndpoint } from '../listSelectionHelpers.js';

/** Broad document/image/office types for record attachments. */
export const DOCUMENT_FILE_ACCEPT = [
  '.pdf', '.csv', '.txt', '.rtf',
  '.doc', '.docx', '.ppt', '.pptx', '.xls', '.xlsx',
  '.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp',
  '.zip', '.rar', '.7z',
  '*/*',
].join(',');

const EXTENSION_MIME_TYPES = {
  pdf: 'application/pdf',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  svg: 'image/svg+xml',
  bmp: 'image/bmp',
  txt: 'text/plain',
  csv: 'text/csv',
  rtf: 'application/rtf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ppt: 'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
};

export function documentFileName(doc) {
  return doc?.file_name || doc?.name || doc?.document_name || `document-${doc?.id || 'file'}`;
}

export function documentExtension(doc) {
  const match = String(documentFileName(doc)).match(/\.([^.]+)$/);
  return match ? match[1].toLowerCase() : '';
}

export function documentMimeType(doc, fallback = 'application/octet-stream') {
  const raw = String(doc?.mime_type || doc?.file_type || '').trim().toLowerCase();
  if (raw && raw.includes('/')) return raw;
  const ext = documentExtension(doc);
  return EXTENSION_MIME_TYPES[ext] || fallback;
}

/** pdf | image | text | none */
export function documentPreviewMode(doc) {
  const ext = documentExtension(doc);
  const mime = documentMimeType(doc, '');
  if (ext === 'pdf' || mime.includes('pdf')) return 'pdf';
  if (/^(png|jpe?g|gif|webp|svg|bmp)$/.test(ext) || mime.startsWith('image/')) return 'image';
  if (/^(txt|csv)$/.test(ext) || mime.startsWith('text/')) return 'text';
  return 'none';
}

export function canPreviewDocument(doc) {
  return documentPreviewMode(doc) !== 'none';
}

export async function fetchDocumentBlob(id) {
  const res = await api.get(`/documents/${id}/download`, { responseType: 'blob' });
  return res.data;
}

function triggerBlobDownload(blob, fileName, mimeType) {
  const url = URL.createObjectURL(new Blob([blob], { type: mimeType }));
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

function openBlobInNewTab(blob, mimeType) {
  const url = URL.createObjectURL(new Blob([blob], { type: mimeType }));
  const opened = window.open(url, '_blank', 'noopener,noreferrer');
  if (!opened) {
    URL.revokeObjectURL(url);
    return false;
  }
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
  return true;
}

/** Open the original file — inline in a new tab when supported, otherwise download/open locally. */
export async function openDocument(doc) {
  const blob = await fetchDocumentBlob(doc.id);
  const mimeType = blob.type || documentMimeType(doc);
  const fileName = documentFileName(doc);
  if (documentPreviewMode(doc) !== 'none') {
    const opened = openBlobInNewTab(blob, mimeType);
    if (!opened) triggerBlobDownload(blob, fileName, mimeType);
    return;
  }
  triggerBlobDownload(blob, fileName, mimeType);
}

export async function createDocumentPreviewSource(doc) {
  const blob = await fetchDocumentBlob(doc.id);
  const mimeType = blob.type || documentMimeType(doc);
  const mode = documentPreviewMode(doc);
  const url = URL.createObjectURL(new Blob([blob], { type: mimeType }));
  let textContent = null;
  if (mode === 'text') {
    textContent = await blob.text();
  }
  return {
    url,
    mimeType,
    mode,
    textContent,
    fileName: documentFileName(doc),
    revoke: () => URL.revokeObjectURL(url),
  };
}

export function formatFileSize(bytes) {
  const size = Number(bytes);
  if (!size || Number.isNaN(size)) return '—';
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

export function matchesRelatedRecord(doc, relatedType, relatedId) {
  const type = String(doc?.related_type || doc?.related_entity_type || '').toLowerCase();
  const id = String(doc?.related_id || doc?.related_entity_id || '');
  return type === String(relatedType || '').toLowerCase() && id === String(relatedId || '');
}

function buildUserMap(users = []) {
  return Object.fromEntries(
    users.map((user) => [String(user.id), user]).filter(([id]) => id && id !== 'undefined'),
  );
}

function documentOwnerId(doc) {
  return doc?.owner_id
    || doc?.created_by_id
    || doc?.uploaded_by_id
    || (typeof doc?.created_by === 'string' ? doc.created_by : null)
    || (typeof doc?.uploaded_by === 'string' ? doc.uploaded_by : null);
}

function nestedDocumentOwner(doc) {
  if (doc?.owner && typeof doc.owner === 'object') return doc.owner;
  if (doc?.created_by && typeof doc.created_by === 'object') return doc.created_by;
  if (doc?.uploaded_by && typeof doc.uploaded_by === 'object') return doc.uploaded_by;
  if (doc?.created_by_user && typeof doc.created_by_user === 'object') return doc.created_by_user;
  if (doc?.uploaded_by_user && typeof doc.uploaded_by_user === 'object') return doc.uploaded_by_user;
  return null;
}

export function resolveDocumentOwnerName(doc, userMap = {}) {
  const nested = nestedDocumentOwner(doc);
  if (nested) {
    const fromNested = ownerName({ owner: nested }) || userDisplayName(nested);
    if (fromNested) return fromNested;
  }

  const direct = doc?.owner_name || doc?.created_by_name || doc?.uploaded_by_name || doc?.user_name;
  if (direct) return direct;

  const ownerId = documentOwnerId(doc);
  if (ownerId && userMap[String(ownerId)]) {
    return userDisplayName(userMap[String(ownerId)]) || userMap[String(ownerId)].name || null;
  }

  return ownerName(doc) || null;
}

export function normalizeDocument(doc, userMap = {}) {
  const owner_id = documentOwnerId(doc) || doc?.owner_id || null;
  return {
    ...doc,
    owner_id,
    name: doc.name ?? doc.document_name,
    document_name: doc.document_name ?? doc.name,
    file_type: doc.file_type ?? doc.mime_type,
    owner_name: resolveDocumentOwnerName(doc, userMap),
  };
}

export async function listDocuments(params = {}) {
  const { page_size, limit, ...rest } = params;
  const res = await api.get('/documents', { params: { ...rest, limit: limit ?? page_size ?? DEFAULT_PAGE_SIZE } });
  const data = res.data.data || [];
  const total = res.data.meta?.total ?? res.data.total ?? data.length;
  let userMap = {};
  try {
    userMap = buildUserMap(await fetchUsers());
  } catch {
    userMap = {};
  }
  return {
    data: data.map((doc) => normalizeDocument(doc, userMap)),
    total,
    meta: res.data.meta || { total, page: res.data.page, limit: res.data.limit },
  };
}

export async function listDocumentsForRecord(relatedType, relatedId) {
  if (!relatedType || !relatedId) return [];

  const first = await listDocuments({
    related_type: relatedType,
    related_id: relatedId,
    page: 1,
    page_size: 100,
  });
  const filterBatch = (docs) => (docs || []).filter((doc) => matchesRelatedRecord(doc, relatedType, relatedId));
  const firstMatches = filterBatch(first.data);
  const apiHonorsFilter = first.data.length === 0 || firstMatches.length === first.data.length;

  let page = 1;
  let all = [...firstMatches];
  let total = first.total ?? first.data.length;

  while (page < 20) {
    const reachedEnd = page * 100 >= total || (page === 1 && first.data.length < 100);
    if (reachedEnd) break;
    page += 1;
    const next = await listDocuments(
      apiHonorsFilter
        ? { related_type: relatedType, related_id: relatedId, page, page_size: 100 }
        : { page, page_size: 100 },
    );
    all = all.concat(filterBatch(next.data));
    total = next.total ?? total;
    if (!next.data.length) break;
  }

  return all;
}

export async function listAllMatchingDocumentIds(params = {}) {
  const { page_size, limit, search, sort_by, sort_order, ...rest } = params;
  return fetchAllIdsFromEndpoint('/documents', {
    ...rest,
    ...(search ? { search } : {}),
    ...(sort_by ? { sort_by } : {}),
    ...(sort_order ? { sort_order } : {}),
  }, { useLimit: true });
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
  const blob = await fetchDocumentBlob(id);
  triggerBlobDownload(blob, fileName || `document-${id}`, blob.type || 'application/octet-stream');
}
