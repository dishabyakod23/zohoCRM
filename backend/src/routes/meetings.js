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
    let where = ['m.deleted_at IS NULL'];
    const params = [];
    let i = 1;
    if (search) { where.push(`m.title ILIKE $${i}`); params.push(`%${search}%`); i++; }
    const whereStr = 'WHERE ' + where.join(' AND ');
    const result = await pool.query(
      `SELECT m.*, u.name as host_name FROM meetings m LEFT JOIN users u ON m.host_id=u.id
       ${whereStr} ORDER BY m.from_datetime DESC LIMIT $${i} OFFSET $${i + 1}`,
      [...params, limit, offset]
    );
    const countRes = await pool.query(`SELECT COUNT(*) FROM meetings m ${whereStr}`, params);
    listOk(res, result.rows, countRes.rows[0].count, page, limit);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/:id', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT m.*, u.name as host_name FROM meetings m LEFT JOIN users u ON m.host_id=u.id WHERE m.id=$1 AND m.deleted_at IS NULL`,
      [req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Meeting not found' });
    recordOk(res, result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/', requireEdit, async (req, res) => {
  const { title, from_datetime, to_datetime, host_id, participants, location, description, related_type, related_id, reminder } = req.body;
  if (!title || !from_datetime || !to_datetime || !host_id)
    return res.status(400).json({ error: 'Title, from/to datetime, and host are required' });
  try {
    const result = await pool.query(
      `INSERT INTO meetings (title, from_datetime, to_datetime, host_id, participants, location, description, related_type, related_id, reminder, owner_id, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$11) RETURNING *`,
      [title, from_datetime, to_datetime, host_id, participants || [], location, description, related_type, related_id, reminder, req.user.id]
    );
    recordOk(res, result.rows[0], 201);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

const updateMeeting = async (req, res) => {
  const { title, from_datetime, to_datetime, host_id, participants, location, description, related_type, related_id, reminder } = req.body;
  try {
    const result = await pool.query(
      `UPDATE meetings SET title=$1, from_datetime=$2, to_datetime=$3, host_id=$4, participants=$5, location=$6,
       description=$7, related_type=$8, related_id=$9, reminder=$10, updated_by=$11, updated_at=NOW()
       WHERE id=$12 AND deleted_at IS NULL RETURNING *`,
      [title, from_datetime, to_datetime, host_id, participants || [], location, description, related_type, related_id, reminder, req.user.id, req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Meeting not found' });
    recordOk(res, result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
};

router.put('/:id', requireEdit, updateMeeting);
router.patch('/:id', requireEdit, updateMeeting);

router.delete('/:id', requireEdit, async (req, res) => {
  try {
    await softDelete('meetings', req.params.id, req.user.id);
    res.json({ message: 'Meeting moved to recycle bin' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
