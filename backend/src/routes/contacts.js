const express = require('express');
const pool = require('../db/pool');
const auth = require('../middleware/auth');
const { requireEdit } = require('../middleware/roles');
const { softDelete, parseCSV, listOk, recordOk } = require('../utils/helpers');

const router = express.Router();
router.use(auth);

router.get('/', async (req, res) => {
  try {
    const { search, page = 1, page_size = 20, limit } = req.query;
    const pageLimit = parseInt(limit || page_size);
    const offset = (page - 1) * pageLimit;
    let where = ['c.deleted_at IS NULL'];
    let params = [];
    let i = 1;
    if (search) { where.push(`(c.first_name ILIKE $${i} OR c.last_name ILIKE $${i} OR c.email ILIKE $${i})`); params.push(`%${search}%`); i++; }
    const whereStr = 'WHERE ' + where.join(' AND ');
    const result = await pool.query(
      `SELECT c.*, u.name as owner_name, a.name as account_name FROM contacts c
       LEFT JOIN users u ON c.owner_id=u.id LEFT JOIN accounts a ON c.account_id=a.id
       ${whereStr} ORDER BY c.created_at DESC LIMIT $${i} OFFSET $${i+1}`,
      [...params, pageLimit, offset]
    );
    const countRes = await pool.query(`SELECT COUNT(*) FROM contacts c ${whereStr}`, params);
    listOk(res, result.rows, countRes.rows[0].count, page, pageLimit);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/:id', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT c.*, u.name as owner_name, a.name as account_name FROM contacts c
       LEFT JOIN users u ON c.owner_id=u.id LEFT JOIN accounts a ON c.account_id=a.id
       WHERE c.id=$1 AND c.deleted_at IS NULL`, [req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Contact not found' });
    recordOk(res, result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/', requireEdit, async (req, res) => {
  const b = req.body;
  if (!b.last_name || !b.account_id || !b.email || !b.phone)
    return res.status(400).json({ error: 'Last name, account, email, and phone are required' });
  const dup = await pool.query(`SELECT id FROM contacts WHERE email=$1 AND deleted_at IS NULL`, [b.email]);
  if (dup.rows[0]) return res.status(409).json({ error: 'A record with this email already exists', existingId: dup.rows[0].id });
  try {
    const result = await pool.query(
      `INSERT INTO contacts (first_name, last_name, email, phone, mobile, title, account_id, department, lead_source, description, company, owner_id, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,
      [b.first_name, b.last_name, b.email, b.phone, b.mobile, b.title, b.account_id, b.department, b.lead_source, b.description, b.company, b.owner_id || req.user.id, req.user.id]
    );
    recordOk(res, result.rows[0], 201);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

const updateContact = async (req, res) => {
  const b = req.body;
  try {
    const result = await pool.query(
      `UPDATE contacts SET first_name=$1, last_name=$2, email=$3, phone=$4, mobile=$5, title=$6, account_id=$7,
       department=$8, lead_source=$9, description=$10, owner_id=$11, updated_by=$12, updated_at=NOW()
       WHERE id=$13 AND deleted_at IS NULL RETURNING *`,
      [b.first_name, b.last_name, b.email, b.phone, b.mobile, b.title, b.account_id, b.department, b.lead_source, b.description, b.owner_id, req.user.id, req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Contact not found' });
    recordOk(res, result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
};

router.put('/:id', requireEdit, updateContact);
router.patch('/:id', requireEdit, updateContact);

router.delete('/:id', requireEdit, async (req, res) => {
  try {
    await softDelete('contacts', req.params.id, req.user.id);
    res.json({ message: 'Contact moved to recycle bin' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/bulk-upload', requireEdit, async (req, res) => {
  const { csv, mapping } = req.body;
  if (!csv) return res.status(400).json({ error: 'CSV data required' });
  try {
    const { rows } = parseCSV(csv);
    const ready = [], errors = [];
    for (const row of rows) {
      const last_name = row[mapping?.last_name || 'last_name'];
      const email = row[mapping?.email || 'email'];
      const phone = row[mapping?.phone || 'phone'];
      const account_name = row[mapping?.account_name || 'account_name'];
      if (!last_name || !email || !phone || !account_name) { errors.push({ row: row._row, error: 'Missing mandatory fields' }); continue; }
      const acct = await pool.query(`SELECT id FROM accounts WHERE name ILIKE $1 AND deleted_at IS NULL`, [account_name]);
      if (!acct.rows[0]) { errors.push({ row: row._row, error: `Account not found: ${account_name}` }); continue; }
      ready.push({ ...row, last_name, email, phone, account_id: acct.rows[0].id });
    }
    res.json({ data: { ready: ready.length, errors: errors.length, readyRecords: ready, errorRecords: errors } });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
