const express = require('express');
const pool = require('../db/pool');
const auth = require('../middleware/auth');
const { requireEdit } = require('../middleware/roles');
const { softDelete } = require('../utils/helpers');
const { logAudit } = require('../utils/audit');

const router = express.Router();
router.use(auth);

router.get('/', async (req, res) => {
  try {
    const { search, status, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;
    let where = ['t.deleted_at IS NULL'];
    const params = [];
    let i = 1;
    if (search) { where.push(`t.title ILIKE $${i}`); params.push(`%${search}%`); i++; }
    if (status) { where.push(`t.status=$${i}`); params.push(status); i++; }
    const whereStr = 'WHERE ' + where.join(' AND ');
    const result = await pool.query(
      `SELECT t.*, u.name as assigned_name FROM tasks t
       LEFT JOIN users u ON t.assigned_to=u.id ${whereStr}
       ORDER BY t.due_date ASC LIMIT $${i} OFFSET $${i + 1}`,
      [...params, limit, offset]
    );
    const countRes = await pool.query(`SELECT COUNT(*) FROM tasks t ${whereStr}`, params);
    res.json({ data: result.rows, total: parseInt(countRes.rows[0].count), page: +page, limit: +limit });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/:id', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT t.*, u.name as assigned_name FROM tasks t LEFT JOIN users u ON t.assigned_to=u.id WHERE t.id=$1 AND t.deleted_at IS NULL`,
      [req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Task not found' });
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/', requireEdit, async (req, res) => {
  const { title, due_date, assigned_to, status, priority, related_type, related_id, contact_id, description } = req.body;
  if (!title || !due_date || !assigned_to || !status)
    return res.status(400).json({ error: 'Title, due date, assigned to, and status are required' });
  try {
    const result = await pool.query(
      `INSERT INTO tasks (title, due_date, assigned_to, status, priority, related_type, related_id, contact_id, description, owner_id, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$10) RETURNING *`,
      [title, due_date, assigned_to, status, priority || 'Normal', related_type, related_id, contact_id, description, req.user.id]
    );
    await logAudit({ recordType: 'task', recordId: result.rows[0].id, action: 'created', userId: req.user.id });
    res.status(201).json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/:id', requireEdit, async (req, res) => {
  const { title, due_date, assigned_to, status, priority, related_type, related_id, contact_id, description } = req.body;
  try {
    const result = await pool.query(
      `UPDATE tasks SET title=$1, due_date=$2, assigned_to=$3, status=$4, priority=$5,
       related_type=$6, related_id=$7, contact_id=$8, description=$9, updated_by=$10, updated_at=NOW()
       WHERE id=$11 AND deleted_at IS NULL RETURNING *`,
      [title, due_date, assigned_to, status, priority, related_type, related_id, contact_id, description, req.user.id, req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Task not found' });
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/:id', requireEdit, async (req, res) => {
  try {
    await softDelete('tasks', req.params.id, req.user.id);
    res.json({ message: 'Task moved to recycle bin' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
