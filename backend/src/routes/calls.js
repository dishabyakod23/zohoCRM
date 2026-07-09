const express = require('express');
const pool = require('../db/pool');
const auth = require('../middleware/auth');
const { requireEdit } = require('../middleware/roles');
const { softDelete, listOk, recordOk, DEFAULT_PAGE_SIZE } = require('../utils/helpers');

const router = express.Router();
router.use(auth);

router.get('/', async (req, res) => {
  try {
    const { search, page = 1, limit = DEFAULT_PAGE_SIZE } = req.query;
    const offset = (page - 1) * limit;
    let where = ['c.deleted_at IS NULL'];
    const params = [];
    let i = 1;
    if (search) { where.push(`c.subject ILIKE $${i}`); params.push(`%${search}%`); i++; }
    const whereStr = 'WHERE ' + where.join(' AND ');
    const result = await pool.query(
      `SELECT c.*, u.name as assigned_name FROM calls c LEFT JOIN users u ON c.assigned_to=u.id
       ${whereStr} ORDER BY c.start_time DESC LIMIT $${i} OFFSET $${i + 1}`,
      [...params, limit, offset]
    );
    const countRes = await pool.query(`SELECT COUNT(*) FROM calls c ${whereStr}`, params);
    listOk(res, result.rows, countRes.rows[0].count, page, limit);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/:id', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT c.*, u.name as assigned_name FROM calls c LEFT JOIN users u ON c.assigned_to=u.id WHERE c.id=$1 AND c.deleted_at IS NULL`,
      [req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Call not found' });
    recordOk(res, result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/', requireEdit, async (req, res) => {
  const { subject, call_type, status, start_time, duration, assigned_to, related_type, related_id, description } = req.body;
  if (!subject || !call_type || !start_time || !assigned_to)
    return res.status(400).json({ error: 'Subject, call type, start time, and assigned to are required' });
  try {
    const result = await pool.query(
      `INSERT INTO calls (subject, call_type, status, start_time, duration, assigned_to, related_type, related_id, description, owner_id, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$10) RETURNING *`,
      [subject, call_type, status || 'Scheduled', start_time, duration, assigned_to, related_type, related_id, description, req.user.id]
    );
    recordOk(res, result.rows[0], 201);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

const updateCall = async (req, res) => {
  const { subject, call_type, status, start_time, duration, assigned_to, related_type, related_id, description } = req.body;
  try {
    const result = await pool.query(
      `UPDATE calls SET subject=$1, call_type=$2, status=$3, start_time=$4, duration=$5, assigned_to=$6,
       related_type=$7, related_id=$8, description=$9, updated_by=$10, updated_at=NOW()
       WHERE id=$11 AND deleted_at IS NULL RETURNING *`,
      [subject, call_type, status, start_time, duration, assigned_to, related_type, related_id, description, req.user.id, req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Call not found' });
    recordOk(res, result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
};

router.put('/:id', requireEdit, updateCall);
router.patch('/:id', requireEdit, updateCall);

router.delete('/:id', requireEdit, async (req, res) => {
  try {
    await softDelete('calls', req.params.id, req.user.id);
    res.json({ message: 'Call moved to recycle bin' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
