import api from '../api.js';
import { assigneeName, formatEnumLabel, listResult, omitEmpty, toIsoDatetime } from '../activityHelpers.js';

export function normalizeTask(task) {
  return {
    ...task,
    title: task.subject,
    assigned_name: assigneeName(task),
    status_label: formatEnumLabel(task.status),
    priority_label: formatEnumLabel(task.priority),
  };
}

function toTaskPayload(form, { partial = false } = {}) {
  const payload = omitEmpty({
    subject: form.title ?? form.subject,
    due_date: form.due_date ? toIsoDatetime(form.due_date) : undefined,
    assigned_to_id: form.assigned_to || form.assigned_to_id || null,
    status: form.status,
    priority: form.priority,
    description: form.description,
    contact_id: form.contact_id || null,
  });
  if (partial) {
    if (payload.assigned_to_id === '') payload.assigned_to_id = null;
  }
  return payload;
}

export async function listTasks(params = {}) {
  const res = await api.get('/tasks', { params });
  const result = listResult(res);
  return { ...result, data: result.data.map(normalizeTask) };
}

export async function getTask(id) {
  const res = await api.get(`/tasks/${id}`);
  return normalizeTask(res.data.data);
}

export async function createTask(form) {
  const res = await api.post('/tasks', toTaskPayload(form));
  return normalizeTask(res.data.data);
}

export async function updateTask(id, form) {
  const res = await api.patch(`/tasks/${id}`, toTaskPayload(form, { partial: true }));
  return normalizeTask(res.data.data);
}

export async function deleteTask(id) {
  await api.delete(`/tasks/${id}`);
}
