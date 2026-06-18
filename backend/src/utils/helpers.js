const pool = require('../db/pool');

const ROLES = {
  SUPER_ADMIN: 'super_admin',
  SALES_MANAGER: 'sales_manager',
  SALES_REP: 'sales_rep',
  VIEWER: 'viewer',
};

function normalizeRole(role) {
  if (role === 'admin') return ROLES.SUPER_ADMIN;
  return role;
}

function canDownload(role) {
  const r = normalizeRole(role);
  return r === ROLES.SUPER_ADMIN || r === ROLES.SALES_MANAGER;
}

function canEdit(role) {
  const r = normalizeRole(role);
  return r !== ROLES.VIEWER;
}

function isAdmin(role) {
  return normalizeRole(role) === ROLES.SUPER_ADMIN;
}

function isManagerOrAdmin(role) {
  const r = normalizeRole(role);
  return r === ROLES.SUPER_ADMIN || r === ROLES.SALES_MANAGER;
}

async function getOwnerFilter(user) {
  const role = normalizeRole(user.role);
  if (role === ROLES.SUPER_ADMIN) return { clause: '', params: [] };
  if (role === ROLES.SALES_MANAGER) {
    const team = await pool.query(
      `SELECT id FROM users WHERE manager_id = $1 OR id = $1`,
      [user.id]
    );
    const ids = team.rows.map(r => r.id);
    if (!ids.length) return { clause: 'AND owner_id = $1', params: [user.id] };
    return { clause: `AND owner_id = ANY($1)`, params: [ids] };
  }
  return { clause: 'AND owner_id = $1', params: [user.id] };
}

async function softDelete(table, id, userId) {
  await pool.query(
    `UPDATE ${table} SET deleted_at = NOW(), updated_by = $2, updated_at = NOW() WHERE id = $1`,
    [id, userId]
  );
}

async function restoreRecord(table, id) {
  await pool.query(`UPDATE ${table} SET deleted_at = NULL WHERE id = $1`, [id]);
}

async function permanentDelete(table, id) {
  await pool.query(`DELETE FROM ${table} WHERE id = $1`, [id]);
}

function parseCSV(text) {
  const lines = text.trim().split(/\r?\n/);
  if (!lines.length) return { headers: [], rows: [] };
  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
  const rows = lines.slice(1).map((line, idx) => {
    const values = line.match(/("([^"]|"")*"|[^,]*)/g) || [];
    const obj = { _row: idx + 2 };
    headers.forEach((h, i) => {
      let v = (values[i] || '').trim().replace(/^"|"$/g, '').replace(/""/g, '"');
      obj[h] = v;
    });
    return obj;
  });
  return { headers, rows };
}

/** Wrap a list result so the frontend meta.total works */
function listOk(res, rows, total, page, limit) {
  res.json({ data: rows, meta: { total: parseInt(total), page: parseInt(page), limit: parseInt(limit) } });
}

/** Wrap a single record so the frontend res.data.data works */
function recordOk(res, row, status = 200) {
  res.status(status).json({ data: row });
}

module.exports = {
  ROLES, normalizeRole, canDownload, canEdit, isAdmin, isManagerOrAdmin,
  getOwnerFilter, softDelete, restoreRecord, permanentDelete, parseCSV,
  listOk, recordOk,
};
