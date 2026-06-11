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
    let where = ['a.deleted_at IS NULL'];
    let params = [];
    let i = 1;
    if (search) { where.push(`(a.name ILIKE $${i} OR a.industry ILIKE $${i})`); params.push(`%${search}%`); i++; }
    const whereStr = 'WHERE ' + where.join(' AND ');
    const result = await pool.query(
      `SELECT a.*, u.name as owner_name FROM accounts a LEFT JOIN users u ON a.owner_id=u.id
       ${whereStr} ORDER BY a.created_at DESC LIMIT $${i} OFFSET $${i+1}`,
      [...params, limit, offset]
    );
    const countRes = await pool.query(`SELECT COUNT(*) FROM accounts a ${whereStr}`, params);
    res.json({ data: result.rows, total: parseInt(countRes.rows[0].count), page: parseInt(page), limit: parseInt(limit) });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/:id', async (req, res) => {
  try {
    const [account, contacts, deals, tasks] = await Promise.all([
      pool.query(`SELECT a.*, u.name as owner_name FROM accounts a LEFT JOIN users u ON a.owner_id=u.id WHERE a.id=$1 AND a.deleted_at IS NULL`, [req.params.id]),
      pool.query(`SELECT id, first_name, last_name, email, phone, mobile FROM contacts WHERE account_id=$1 AND deleted_at IS NULL`, [req.params.id]),
      pool.query(`SELECT id, name, amount, stage, probability, close_date FROM deals WHERE account_id=$1 AND deleted_at IS NULL`, [req.params.id]),
      pool.query(`SELECT id, title, due_date, status FROM tasks WHERE related_type='account' AND related_id=$1 AND deleted_at IS NULL ORDER BY due_date LIMIT 5`, [req.params.id]),
    ]);
    if (!account.rows[0]) return res.status(404).json({ error: 'Account not found' });
    res.json({ ...account.rows[0], contacts: contacts.rows, deals: deals.rows, tasks: tasks.rows });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/', requireEdit, async (req, res) => {
  const b = req.body;
  if (!b.name || !b.phone) return res.status(400).json({ error: 'Account name and phone are required' });
  try {
    const result = await pool.query(
      `INSERT INTO accounts (name, industry, website, phone, city, country, account_type, annual_revenue, description, owner_id, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
      [b.name, b.industry, b.website, b.phone, b.city, b.country, b.account_type, b.annual_revenue, b.description, b.owner_id || req.user.id, req.user.id]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/:id', requireEdit, async (req, res) => {
  const b = req.body;
  try {
    const result = await pool.query(
      `UPDATE accounts SET name=$1, industry=$2, website=$3, phone=$4, city=$5, country=$6, account_type=$7,
       annual_revenue=$8, description=$9, owner_id=$10, updated_by=$11, updated_at=NOW()
       WHERE id=$12 AND deleted_at IS NULL RETURNING *`,
      [b.name, b.industry, b.website, b.phone, b.city, b.country, b.account_type, b.annual_revenue, b.description, b.owner_id, req.user.id, req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Account not found' });
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/:id', requireEdit, async (req, res) => {
  try {
    const [c, d] = await Promise.all([
      pool.query(`SELECT COUNT(*) FROM contacts WHERE account_id=$1 AND deleted_at IS NULL`, [req.params.id]),
      pool.query(`SELECT COUNT(*) FROM deals WHERE account_id=$1 AND deleted_at IS NULL`, [req.params.id]),
    ]);
    await softDelete('accounts', req.params.id, req.user.id);
    res.json({
      message: 'Account moved to recycle bin',
      linkedContacts: parseInt(c.rows[0].count),
      linkedDeals: parseInt(d.rows[0].count),
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
