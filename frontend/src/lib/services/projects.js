import api from '../api.js';
import { assigneeName, formatEnumLabel, listResult, omitEmpty, toDateOnly } from '../activityHelpers.js';
import { DEFAULT_PAGE_SIZE } from '../constants.js';
import { listAllMatchingIdsFromListFn } from '../listSelectionHelpers.js';

export function normalizeProject(project, accountMap = {}) {
  const account = accountMap[project.account_id];
  return {
    ...project,
    name: project.project_name || project.name,
    account_name: account?.label || account?.name,
    status_label: formatEnumLabel(project.status),
    owner_name: assigneeName(project),
    deal_size: project.deal_size ?? project.budget ?? null,
  };
}

function toProjectPayload(form) {
  return omitEmpty({
    project_name: form.name ?? form.project_name,
    account_id: form.account_id,
    contact_id: form.contact_id || null,
    deal_id: form.deal_id || null,
    status: form.status,
    start_date: form.start_date ? toDateOnly(form.start_date) : undefined,
    end_date: form.end_date ? toDateOnly(form.end_date) : undefined,
    budget: form.budget ?? form.deal_size ?? null,
    actual_cost: form.actual_cost || null,
    description: form.description,
    owner_id: form.owner_id || null,
  });
}

export async function listProjects(params = {}, accountMap = {}) {
  const res = await api.get('/projects', { params });
  const result = listResult(res);
  return { ...result, data: result.data.map((p) => normalizeProject(p, accountMap)) };
}

function matchesProjectSearch(project, search) {
  if (!search) return true;
  const q = search.toLowerCase();
  return (project.name || '').toLowerCase().includes(q)
    || (project.account_name || '').toLowerCase().includes(q)
    || (project.status_label || '').toLowerCase().includes(q);
}

export async function listAllMatchingProjectIds(params = {}, accountMap = {}, { search } = {}) {
  const all = [];
  let page = 1;
  while (page <= 50) {
    const result = await listProjects({ ...params, page, page_size: DEFAULT_PAGE_SIZE }, accountMap);
    const batch = (result.data || []).filter((project) => matchesProjectSearch(project, search));
    all.push(...batch);
    if (!result.data?.length || page * DEFAULT_PAGE_SIZE >= (result.total ?? 0)) break;
    page += 1;
  }
  return all.map((project) => project.id).filter(Boolean);
}

export async function getProject(id, accountMap = {}) {
  const res = await api.get(`/projects/${id}`);
  return normalizeProject(res.data.data, accountMap);
}

export async function createProject(form) {
  const res = await api.post('/projects', toProjectPayload(form));
  return normalizeProject(res.data.data);
}

export async function updateProject(id, form) {
  const res = await api.patch(`/projects/${id}`, toProjectPayload(form));
  return normalizeProject(res.data.data);
}

export async function deleteProject(id) {
  await api.delete(`/projects/${id}`);
}
