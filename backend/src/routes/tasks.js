const express = require('express');
const pool = require('../db/pool');
const auth = require('../middleware/auth');
const { requireEdit } = require('../middleware/roles');
const { softDelete, listOk, recordOk } = require('../utils/helpers');

const router = express.Router();
router.use(auth);

router.get('/', async (req, res) => {
  try {
    const { search, status, page = 1, page_size = 20, limit } = req.query;
    const pageLimit = parseInt(limit || page_size);
    const offset = (page - 1) * pageLimit;
    let where = ['t.deleted_at IS NULL'];
    const params = [];
    let i = 1;
    if (search) { where.push(`(t.title ILIKE $${i} OR t.subject ILIKE $${i})`); params.push(`%${search}%`); i++; }
    if (status) { where.push(`t.status=$${i}`); params.push(status); i++; }
    const whereStr = 'WHERE ' + where.join(' AND ');
    const result = await pool.query(
      `SELECT t.*, t.title as subject, u.name as assigned_name FROM tasks t
       LEFT JOIN users u ON t.assigned_to=u.id ${whereStr}
       ORDER BY t.due_date ASC LIMIT $${i} OFFSET $${i + 1}`,
      [...params, pageLimit, offset]
    );
    const countRes = await pool.query(`SELECT COUNT(*) FROM tasks t ${whereStr}`, params);
    listOk(res, result.rows, countRes.rows[0].count, page, pageLimit);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/:id', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT t.*, t.title as subject, u.name as assigned_name FROM tasks t
       LEFT JOIN users u ON t.assigned_to=u.id WHERE t.id=$1 AND t.deleted_at IS NULL`,
      [req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Task not found' });
    recordOk(res, result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/', requireEdit, async (req, res) => {
  const b = req.body;
  const title = b.title ?? b.subject;
  const assignedTo = b.assigned_to || b.assigned_to_id;
  if (!title || !b.due_date || !assignedTo)
    return res.status(400).json({ error: 'Title, due date, and assigned user are required' });
  try {
    const result = await pool.query(
      `INSERT INTO tasks (title, due_date, assigned_to, status, priority, related_type, related_id, contact_id, description, owner_id, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$10) RETURNING *`,
      [title, b.due_date, assignedTo, b.status || 'not_started', b.priority || 'medium',
       b.related_type, b.related_id, b.contact_id, b.description, req.user.id]
    );
    recordOk(res, result.rows[0], 201);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

const updateTask = async (req, res) => {
  const b = req.body;
  const title = b.title ?? b.subject;
  const assignedTo = b.assigned_to || b.assigned_to_id;
  try {
    const result = await pool.query(
      `UPDATE tasks SET title=COALESCE($1,title), due_date=COALESCE($2,due_date),
       assigned_to=COALESCE($3,assigned_to), status=COALESCE($4,status), priority=COALESCE($5,priority),
       related_type=$6, related_id=$7, contact_id=$8, description=COALESCE($9,description),
       updated_by=$10, updated_at=NOW() WHERE id=$11 AND deleted_at IS NULL RETURNING *`,
      [title, b.due_date, assignedTo, b.status, b.priority, b.related_type, b.related_id, b.contact_id, b.description, req.user.id, req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Task not found' });
    recordOk(res, result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
};

router.put('/:id', requireEdit, updateTask);
router.patch('/:id', requireEdit, updateTask);

router.delete('/:id', requireEdit, async (req, res) => {
  try {
    await softDelete('tasks', req.params.id, req.user.id);
    res.json({ message: 'Task moved to recycle bin' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
