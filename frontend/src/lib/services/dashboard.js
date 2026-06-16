import api from '../api.js';

export async function getDashboardHome() {
  const res = await api.get('/dashboard/home');
  return res.data.data;
}
