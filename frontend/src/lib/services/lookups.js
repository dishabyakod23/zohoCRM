import api from '../api.js';

export async function fetchLeadStatuses() {
  const res = await api.get('/lookups/lead-statuses');
  return res.data.data || [];
}

export async function fetchUsers() {
  const res = await api.get('/lookups/users');
  return (res.data.data || []).map(u => ({
    ...u,
    name: u.name || `${u.first_name || ''} ${u.last_name || ''}`.trim() || u.email,
  }));
}
