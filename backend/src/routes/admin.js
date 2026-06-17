const express = require('express');
const pool = require('../db/pool');
const bcrypt = require('bcryptjs');
const auth = require('../middleware/auth');
const { requireAdmin } = require('../middleware/roles');

const router = express.Router();
router.use(auth);

const ok = (res, data) => res.json({ data });

/* ── Users ── */

router.get('/users', requireAdmin, async (_, res) => {
  try {
    const result = await pool.query(
      `SELECT id, name, email, role, created_at, updated_at FROM users WHERE deleted_at IS NULL ORDER BY name`
    );
    ok(res, result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/users/:id', requireAdmin, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, name, email, role, created_at FROM users WHERE id=$1 AND deleted_at IS NULL`,
      [req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'User not found' });
    ok(res, result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/users', requireAdmin, async (req, res) => {
  const name = req.body.name || [req.body.first_name, req.body.last_name].filter(Boolean).join(' ');
  const { email, password, role } = req.body;
  if (!name || !email || !password) return res.status(400).json({ error: 'Name, email, and password are required' });
  try {
    const dup = await pool.query(`SELECT id FROM users WHERE email=$1`, [email]);
    if (dup.rows[0]) return res.status(409).json({ error: 'Email already in use' });
    const hash = await bcrypt.hash(password, 10);
    const result = await pool.query(
      `INSERT INTO users (name, email, password_hash, role) VALUES ($1,$2,$3,$4) RETURNING id, name, email, role, created_at`,
      [name, email, hash, role || 'user']
    );
    ok(res, result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.patch('/users/:id', requireAdmin, async (req, res) => {
  const name = req.body.name || [req.body.first_name, req.body.last_name].filter(Boolean).join(' ') || undefined;
  const { email, role, password } = req.body;
  try {
    let q, params;
    if (password) {
      const hash = await bcrypt.hash(password, 10);
      q = `UPDATE users SET name=COALESCE($1,name), email=COALESCE($2,email), role=COALESCE($3,role), password_hash=$4, updated_at=NOW() WHERE id=$5 AND deleted_at IS NULL RETURNING id,name,email,role`;
      params = [name, email, role, hash, req.params.id];
    } else {
      q = `UPDATE users SET name=COALESCE($1,name), email=COALESCE($2,email), role=COALESCE($3,role), updated_at=NOW() WHERE id=$4 AND deleted_at IS NULL RETURNING id,name,email,role`;
      params = [name, email, role, req.params.id];
    }
    const result = await pool.query(q, params);
    if (!result.rows[0]) return res.status(404).json({ error: 'User not found' });
    ok(res, result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/users/:id', requireAdmin, async (req, res) => {
  if (String(req.params.id) === String(req.user.id))
    return res.status(400).json({ error: 'Cannot delete your own account' });
  try {
    await pool.query(`UPDATE users SET deleted_at=NOW() WHERE id=$1`, [req.params.id]);
    res.json({ message: 'User removed' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

/* ── Settings ── */

router.get('/settings', requireAdmin, async (_, res) => {
  try {
    const result = await pool.query(`SELECT key, value FROM settings`);
    const settings = Object.fromEntries(result.rows.map(r => [r.key, r.value]));
    ok(res, settings);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.patch('/settings/app', requireAdmin, async (req, res) => {
  try {
    const entries = Object.entries(req.body);
    for (const [key, value] of entries) {
      await pool.query(
        `INSERT INTO settings (key, value) VALUES ($1,$2) ON CONFLICT (key) DO UPDATE SET value=$2`,
        [key, JSON.stringify(value)]
      );
    }
    ok(res, req.body);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.patch('/settings/weekly-report', requireAdmin, async (req, res) => {
  try {
    await pool.query(
      `INSERT INTO settings (key, value) VALUES ('weekly_report',$1) ON CONFLICT (key) DO UPDATE SET value=$1`,
      [JSON.stringify(req.body)]
    );
    ok(res, req.body);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

/* ── Lead statuses (custom) ── */

const {
  getAllLeadStatuses, addCustomLeadStatus, deleteCustomLeadStatus, slugifyStatus,
} = require('../utils/leadStatusStore');

router.get('/lead-statuses', requireAdmin, async (_, res) => {
  try {
    ok(res, await getAllLeadStatuses());
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/lead-statuses', requireAdmin, async (req, res) => {
  try {
    const created = await addCustomLeadStatus(req.body);
    res.status(201).json({ data: created });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

router.delete('/lead-statuses/:value', requireAdmin, async (req, res) => {
  try {
    const result = await deleteCustomLeadStatus(req.params.value);
    res.json(result);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

module.exports = router;
