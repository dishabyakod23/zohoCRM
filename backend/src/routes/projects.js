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
    let where = ['p.deleted_at IS NULL'];
    const params = [];
    let i = 1;
    if (search) { where.push(`p.name ILIKE $${i}`); params.push(`%${search}%`); i++; }
    const whereStr = 'WHERE ' + where.join(' AND ');
    const result = await pool.query(
      `SELECT p.*, u.name as owner_name, a.name as account_name FROM projects p
       LEFT JOIN users u ON p.owner_id=u.id LEFT JOIN accounts a ON p.account_id=a.id
       ${whereStr} ORDER BY p.created_at DESC LIMIT $${i} OFFSET $${i + 1}`,
      [...params, limit, offset]
    );
    const countRes = await pool.query(`SELECT COUNT(*) FROM projects p ${whereStr}`, params);
    res.json({ data: result.rows, total: parseInt(countRes.rows[0].count), page: +page, limit: +limit });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/:id', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT p.*, u.name as owner_name, a.name as account_name FROM projects p
       LEFT JOIN users u ON p.owner_id=u.id LEFT JOIN accounts a ON p.account_id=a.id
       WHERE p.id=$1 AND p.deleted_at IS NULL`, [req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Project not found' });
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/', requireEdit, async (req, res) => {
  const { name, status, start_date, end_date, account_id, deal_id, description } = req.body;
  if (!name) return res.status(400).json({ error: 'Project name required' });
  try {
    const result = await pool.query(
      `INSERT INTO projects (name, status, start_date, end_date, account_id, deal_id, description, owner_id, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$8) RETURNING *`,
      [name, status || 'In Progress', start_date, end_date, account_id, deal_id, description, req.user.id]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/:id', requireEdit, async (req, res) => {
  const { name, status, start_date, end_date, account_id, deal_id, description } = req.body;
  try {
    const result = await pool.query(
      `UPDATE projects SET name=$1, status=$2, start_date=$3, end_date=$4, account_id=$5, deal_id=$6, description=$7, updated_at=NOW()
       WHERE id=$8 AND deleted_at IS NULL RETURNING *`,
      [name, status, start_date, end_date, account_id, deal_id, description, req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Project not found' });
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/:id', requireEdit, async (req, res) => {
  try {
    await softDelete('projects', req.params.id, req.user.id);
    res.json({ message: 'Project moved to recycle bin' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
