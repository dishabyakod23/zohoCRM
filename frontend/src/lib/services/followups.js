import api from '../api.js';
import { DEFAULT_PAGE_SIZE } from '../constants.js';

const STORAGE_KEY = 'crm_outreach_followups';

function readLocalFollowups() {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function writeLocalFollowups(rows) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(rows));
}

function normalizeFollowup(row) {
  if (!row) return row;
  return {
    ...row,
    id: row.id,
    channel: row.channel || 'linkedin',
    status: row.status || 'pending',
  };
}

/** Server-first; localStorage fallback until /followups API is live. */
export async function listFollowups(params = {}) {
  try {
    const res = await api.get('/followups', { params });
    const data = res.data.data ?? res.data;
    return (Array.isArray(data) ? data : data?.followups || []).map(normalizeFollowup);
  } catch {
    let rows = readLocalFollowups().map(normalizeFollowup);
    if (params.member_type && params.member_id) {
      rows = rows.filter(
        (r) => r.member_type === params.member_type && String(r.member_id) === String(params.member_id),
      );
    }
    if (params.status) rows = rows.filter((r) => r.status === params.status);
    return rows;
  }
}

export async function createFollowup(payload) {
  try {
    const res = await api.post('/followups', payload);
    return normalizeFollowup(res.data.data ?? res.data);
  } catch {
    const row = normalizeFollowup({
      ...payload,
      id: `local-${Date.now()}`,
      created_at: new Date().toISOString(),
      status: payload.status || 'pending',
    });
    const rows = readLocalFollowups();
    rows.push(row);
    writeLocalFollowups(rows);
    return row;
  }
}

export async function updateFollowup(id, payload) {
  try {
    const res = await api.patch(`/followups/${id}`, payload);
    return normalizeFollowup(res.data.data ?? res.data);
  } catch {
    const rows = readLocalFollowups();
    const idx = rows.findIndex((r) => r.id === id);
    if (idx < 0) throw new Error('Follow-up not found');
    rows[idx] = { ...rows[idx], ...payload, updated_at: new Date().toISOString() };
    writeLocalFollowups(rows);
    return normalizeFollowup(rows[idx]);
  }
}

export function bucketFollowups(rows, now = new Date()) {
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const endOfToday = new Date(now);
  endOfToday.setHours(23, 59, 59, 999);

  const overdue = [];
  const dueToday = [];
  const upcoming = [];
  const completed = [];

  for (const row of rows || []) {
    if (row.status === 'completed') {
      completed.push(row);
      continue;
    }
    const due = row.due_at || row.next_action_at || row.due_date;
    if (!due) {
      upcoming.push(row);
      continue;
    }
    const dueDate = new Date(due);
    if (Number.isNaN(dueDate.getTime())) {
      upcoming.push(row);
      continue;
    }
    if (dueDate < startOfToday) overdue.push(row);
    else if (dueDate <= endOfToday) dueToday.push(row);
    else upcoming.push(row);
  }

  const byDue = (a, b) => new Date(a.due_at || a.due_date) - new Date(b.due_at || b.due_date);
  overdue.sort(byDue);
  dueToday.sort(byDue);
  upcoming.sort(byDue);
  completed.sort((a, b) => new Date(b.completed_at || 0) - new Date(a.completed_at || 0));

  return { overdue, dueToday, upcoming, completed };
}

export { DEFAULT_PAGE_SIZE };
