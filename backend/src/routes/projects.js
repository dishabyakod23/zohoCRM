const express = require('express');
const pool = require('../db/pool');
const auth = require('../middleware/auth');
const { requireEdit } = require('../middleware/roles');
const { softDelete, listOk, recordOk } = require('../utils/helpers');

const router = express.Router();
router.use(auth);

router.get('/', async (req, res) => {
  try {
    const { search, page = 1, page_size = 20, limit } = req.query;
    const pageLimit = parseInt(limit || page_size);
    const offset = (page - 1) * pageLimit;
    let where = ['p.deleted_at IS NULL'];
    const params = [];
    let i = 1;
    if (search) { where.push(`p.name ILIKE $${i}`); params.push(`%${search}%`); i++; }
    const whereStr = 'WHERE ' + where.join(' AND ');
    const result = await pool.query(
      `SELECT p.*, u.name as owner_name, a.name as account_name FROM projects p
       LEFT JOIN users u ON p.owner_id=u.id LEFT JOIN accounts a ON p.account_id=a.id
       ${whereStr} ORDER BY p.created_at DESC LIMIT $${i} OFFSET $${i + 1}`,
      [...params, pageLimit, offset]
    );
    const countRes = await pool.query(`SELECT COUNT(*) FROM projects p ${whereStr}`, params);
    listOk(res, result.rows, countRes.rows[0].count, page, pageLimit);
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
    recordOk(res, result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/', requireEdit, async (req, res) => {
  const b = req.body;
  const projectName = b.name || b.project_name;
  if (!projectName) return res.status(400).json({ error: 'Project name required' });
  try {
    const result = await pool.query(
      `INSERT INTO projects (name, status, start_date, end_date, account_id, deal_id, description, budget, owner_id, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$9) RETURNING *`,
      [projectName, b.status || 'not_started', b.start_date, b.end_date, b.account_id || null, b.deal_id || null, b.description, b.budget || b.deal_size || null, req.user.id]
    );
    recordOk(res, result.rows[0], 201);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

const updateProject = async (req, res) => {
  const b = req.body;
  const projectName = b.name || b.project_name;
  try {
    const result = await pool.query(
      `UPDATE projects SET name=$1, status=$2, start_date=$3, end_date=$4, account_id=$5, deal_id=$6, description=$7, budget=$8, updated_at=NOW()
       WHERE id=$9 AND deleted_at IS NULL RETURNING *`,
      [projectName, b.status, b.start_date, b.end_date, b.account_id || null, b.deal_id || null, b.description, b.budget || b.deal_size || null, req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Project not found' });
    recordOk(res, result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
};

router.put('/:id', requireEdit, updateProject);
router.patch('/:id', requireEdit, updateProject);

router.delete('/:id', requireEdit, async (req, res) => {
  try {
    await softDelete('projects', req.params.id, req.user.id);
    res.json({ message: 'Project moved to recycle bin' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
