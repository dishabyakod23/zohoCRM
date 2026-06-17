const express = require('express');
const pool = require('../db/pool');
const auth = require('../middleware/auth');
const { requireEdit } = require('../middleware/roles');
const { softDelete, recordOk } = require('../utils/helpers');

const router = express.Router();
router.use(auth);

const ADMIN_ROLES = new Set(['super_admin', 'sales_manager']);

function canViewAll(role) {
  return ADMIN_ROLES.has(role);
}

router.get('/events', async (req, res) => {
  try {
    const { from, to, owner_id } = req.query;
    if (!from || !to) return res.status(400).json({ error: 'from and to date parameters are required' });

    let where = ['e.deleted_at IS NULL', `e.event_date >= $1`, `e.event_date <= $2`];
    const params = [from, to];
    let i = 3;

    if (canViewAll(req.user.role) && owner_id) {
      where.push(`e.owner_id = $${i}`);
      params.push(owner_id);
      i++;
    } else if (!canViewAll(req.user.role)) {
      where.push(`e.owner_id = $${i}`);
      params.push(req.user.id);
      i++;
    }

    const result = await pool.query(
      `SELECT e.*, u.name as owner_name, c.name as created_by_name
       FROM calendar_events e
       LEFT JOIN users u ON e.owner_id = u.id
       LEFT JOIN users c ON e.created_by = c.id
       WHERE ${where.join(' AND ')}
       ORDER BY e.event_date ASC, e.start_time ASC NULLS FIRST, e.title ASC`,
      params
    );
    res.json({ data: result.rows });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/reminders', async (req, res) => {
  try {
    const today = new Date().toISOString().slice(0, 10);
    let where = ['e.deleted_at IS NULL', 'e.completed = false', 'e.remind_on_login = true', `(e.event_date <= $1)`];
    const params = [today];
    let i = 2;

    if (!canViewAll(req.user.role)) {
      where.push(`e.owner_id = $${i}`);
      params.push(req.user.id);
      i++;
    }

    const result = await pool.query(
      `SELECT e.*, u.name as owner_name
       FROM calendar_events e
       LEFT JOIN users u ON e.owner_id = u.id
       WHERE ${where.join(' AND ')}
       ORDER BY e.event_date ASC, e.start_time ASC NULLS FIRST`,
      params
    );
    res.json({ data: result.rows });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/events', requireEdit, async (req, res) => {
  const b = req.body;
  if (!b.title || !b.event_date) return res.status(400).json({ error: 'Title and date are required' });
  const ownerId = canViewAll(req.user.role) && b.owner_id ? b.owner_id : req.user.id;
  try {
    const result = await pool.query(
      `INSERT INTO calendar_events (
        title, description, event_type, event_date, start_time, end_time, all_day,
        completed, remind_on_login, owner_id, created_by
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
      [
        b.title, b.description || null, b.event_type || 'task', b.event_date,
        b.start_time || null, b.end_time || null, b.all_day !== false,
        !!b.completed, b.remind_on_login !== false, ownerId, req.user.id,
      ]
    );
    recordOk(res, result.rows[0], 201);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

const updateEvent = async (req, res) => {
  const b = req.body;
  try {
    const existing = await pool.query(
      `SELECT * FROM calendar_events WHERE id=$1 AND deleted_at IS NULL`, [req.params.id]
    );
    if (!existing.rows[0]) return res.status(404).json({ error: 'Event not found' });
    if (!canViewAll(req.user.role) && existing.rows[0].owner_id !== req.user.id) {
      return res.status(403).json({ error: 'Not allowed to edit this event' });
    }
    const ownerId = canViewAll(req.user.role) && b.owner_id ? b.owner_id : existing.rows[0].owner_id;
    const result = await pool.query(
      `UPDATE calendar_events SET
        title=COALESCE($1, title), description=$2, event_type=COALESCE($3, event_type),
        event_date=COALESCE($4, event_date), start_time=$5, end_time=$6,
        all_day=COALESCE($7, all_day), completed=COALESCE($8, completed),
        remind_on_login=COALESCE($9, remind_on_login), owner_id=$10,
        updated_by=$11, updated_at=NOW()
       WHERE id=$12 AND deleted_at IS NULL RETURNING *`,
      [
        b.title, b.description ?? existing.rows[0].description,
        b.event_type, b.event_date, b.start_time ?? existing.rows[0].start_time,
        b.end_time ?? existing.rows[0].end_time, b.all_day, b.completed,
        b.remind_on_login, ownerId, req.user.id, req.params.id,
      ]
    );
    recordOk(res, result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
};

router.patch('/events/:id', requireEdit, updateEvent);
router.put('/events/:id', requireEdit, updateEvent);

router.delete('/events/:id', requireEdit, async (req, res) => {
  try {
    const existing = await pool.query(
      `SELECT owner_id FROM calendar_events WHERE id=$1 AND deleted_at IS NULL`, [req.params.id]
    );
    if (!existing.rows[0]) return res.status(404).json({ error: 'Event not found' });
    if (!canViewAll(req.user.role) && existing.rows[0].owner_id !== req.user.id) {
      return res.status(403).json({ error: 'Not allowed to delete this event' });
    }
    await softDelete('calendar_events', req.params.id, req.user.id);
    res.json({ message: 'Event deleted' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
