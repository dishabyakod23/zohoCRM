import api from '../api.js';

/** Fetch CRM email templates for sequence steps. Falls back gracefully if API is unavailable. */
export async function listEmailTemplates() {
  try {
    const res = await api.get('/email-templates', { params: { page_size: 200 } });
    const data = res.data.data ?? res.data;
    return Array.isArray(data) ? data : data?.templates || [];
  } catch {
    return [];
  }
}

export function templateLabel(t) {
  return t?.name || t?.title || t?.label || 'Untitled template';
}
