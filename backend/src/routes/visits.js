const express = require('express');
const pool = require('../db/pool');
const auth = require('../middleware/auth');
const { requireEdit } = require('../middleware/roles');
const { softDelete } = require('../utils/helpers');

const router = express.Router();
router.use(auth);

router.get('/', async (req, res) => {
  try {
    const { search, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;
    let where = ['v.deleted_at IS NULL'];
    const params = [];
    let i = 1;
    if (search) { where.push(`v.title ILIKE $${i}`); params.push(`%${search}%`); i++; }
    const whereStr = 'WHERE ' + where.join(' AND ');
    const result = await pool.query(
      `SELECT v.*, u.name as owner_name FROM visits v LEFT JOIN users u ON v.owner_id=u.id
       ${whereStr} ORDER BY v.visit_date DESC LIMIT $${i} OFFSET $${i + 1}`,
      [...params, limit, offset]
    );
    const countRes = await pool.query(`SELECT COUNT(*) FROM visits v ${whereStr}`, params);
    res.json({ data: result.rows, total: parseInt(countRes.rows[0].count), page: +page, limit: +limit });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/:id', async (req, res) => {
  try {
    const result = await pool.query(`SELECT v.*, u.name as owner_name FROM visits v LEFT JOIN users u ON v.owner_id=u.id WHERE v.id=$1 AND v.deleted_at IS NULL`, [req.params.id]);
    if (!result.rows[0]) return res.status(404).json({ error: 'Visit not found' });
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/', requireEdit, async (req, res) => {
  const { title, visit_date, location, status, related_type, related_id, description } = req.body;
  if (!title || !visit_date) return res.status(400).json({ error: 'Title and visit date required' });
  try {
    const result = await pool.query(
      `INSERT INTO visits (title, visit_date, location, status, related_type, related_id, description, owner_id, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$8) RETURNING *`,
      [title, visit_date, location, status || 'Planned', related_type, related_id, description, req.user.id]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/:id', requireEdit, async (req, res) => {
  const { title, visit_date, location, status, related_type, related_id, description } = req.body;
  try {
    const result = await pool.query(
      `UPDATE visits SET title=$1, visit_date=$2, location=$3, status=$4, related_type=$5, related_id=$6, description=$7, updated_at=NOW()
       WHERE id=$8 AND deleted_at IS NULL RETURNING *`,
      [title, visit_date, location, status, related_type, related_id, description, req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Visit not found' });
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/:id', requireEdit, async (req, res) => {
  try {
    await softDelete('visits', req.params.id, req.user.id);
    res.json({ message: 'Visit moved to recycle bin' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
