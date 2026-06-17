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
    let where = ['a.deleted_at IS NULL'];
    let params = [];
    let i = 1;
    if (search) { where.push(`(a.name ILIKE $${i} OR a.industry ILIKE $${i})`); params.push(`%${search}%`); i++; }
    const whereStr = 'WHERE ' + where.join(' AND ');
    const result = await pool.query(
      `SELECT a.*, u.name as owner_name FROM accounts a LEFT JOIN users u ON a.owner_id=u.id
       ${whereStr} ORDER BY a.created_at DESC LIMIT $${i} OFFSET $${i+1}`,
      [...params, pageLimit, offset]
    );
    const countRes = await pool.query(`SELECT COUNT(*) FROM accounts a ${whereStr}`, params);
    listOk(res, result.rows, countRes.rows[0].count, page, pageLimit);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/:id', async (req, res) => {
  try {
    const [account, contacts, deals, projects, tasks] = await Promise.all([
      pool.query(`SELECT a.*, u.name as owner_name FROM accounts a LEFT JOIN users u ON a.owner_id=u.id WHERE a.id=$1 AND a.deleted_at IS NULL`, [req.params.id]),
      pool.query(`SELECT id, first_name, last_name, email, phone, mobile FROM contacts WHERE account_id=$1 AND deleted_at IS NULL`, [req.params.id]),
      pool.query(`SELECT id, name, amount, stage, probability, close_date FROM deals WHERE account_id=$1 AND deleted_at IS NULL`, [req.params.id]),
      pool.query(`SELECT id, name, status, start_date, end_date, budget FROM projects WHERE account_id=$1 AND deleted_at IS NULL ORDER BY created_at DESC`, [req.params.id]),
      pool.query(`SELECT id, title, due_date, status FROM tasks WHERE related_type='account' AND related_id=$1 AND deleted_at IS NULL ORDER BY due_date LIMIT 5`, [req.params.id]),
    ]);
    if (!account.rows[0]) return res.status(404).json({ error: 'Account not found' });
    recordOk(res, { ...account.rows[0], contacts: contacts.rows, deals: deals.rows, projects: projects.rows, tasks: tasks.rows });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/', requireEdit, async (req, res) => {
  const b = req.body;
  const name = b.name || b.account_name;
  if (!name) return res.status(400).json({ error: 'Account name is required' });
  try {
    const result = await pool.query(
      `INSERT INTO accounts (
        name, account_site, account_number, account_type, industry, annual_revenue, rating,
        phone, fax, website, ticker_symbol, ownership, employees, sic_code,
        parent_account_id,
        billing_flat, billing_street, billing_city, billing_state, billing_country, billing_zip, billing_lat, billing_lng,
        shipping_flat, shipping_street, shipping_city, shipping_state, shipping_country, shipping_zip, shipping_lat, shipping_lng,
        description, proposal_amount, deal_size, owner_id, created_by
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,
        $16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,
        $32,$33,$34,$35,$36
      ) RETURNING *`,
      [
        name, b.account_site, b.account_number, b.account_type, b.industry,
        b.annual_revenue || null, b.rating, b.phone || null, b.fax, b.website,
        b.ticker_symbol, b.ownership, b.employees || null, b.sic_code,
        b.parent_account_id || null,
        b.billing_flat, b.billing_street, b.billing_city, b.billing_state, b.billing_country, b.billing_zip,
        b.billing_lat || null, b.billing_lng || null,
        b.shipping_flat, b.shipping_street, b.shipping_city, b.shipping_state, b.shipping_country, b.shipping_zip,
        b.shipping_lat || null, b.shipping_lng || null,
        b.description, b.proposal_amount || b.deal_size || null, b.deal_size || b.proposal_amount || null,
        b.owner_id || req.user.id, req.user.id,
      ]
    );
    recordOk(res, result.rows[0], 201);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

const updateAccount = async (req, res) => {
  const b = req.body;
  const name = b.name || b.account_name;
  try {
    const result = await pool.query(
      `UPDATE accounts SET
        name=$1, account_site=$2, account_number=$3, account_type=$4, industry=$5, annual_revenue=$6, rating=$7,
        phone=$8, fax=$9, website=$10, ticker_symbol=$11, ownership=$12, employees=$13, sic_code=$14,
        parent_account_id=$15,
        billing_flat=$16, billing_street=$17, billing_city=$18, billing_state=$19, billing_country=$20, billing_zip=$21, billing_lat=$22, billing_lng=$23,
        shipping_flat=$24, shipping_street=$25, shipping_city=$26, shipping_state=$27, shipping_country=$28, shipping_zip=$29, shipping_lat=$30, shipping_lng=$31,
        description=$32, proposal_amount=$33, deal_size=$34, owner_id=$35, updated_by=$36, updated_at=NOW()
       WHERE id=$37 AND deleted_at IS NULL RETURNING *`,
      [
        name, b.account_site, b.account_number, b.account_type, b.industry,
        b.annual_revenue || null, b.rating, b.phone, b.fax, b.website,
        b.ticker_symbol, b.ownership, b.employees || null, b.sic_code,
        b.parent_account_id || null,
        b.billing_flat, b.billing_street, b.billing_city, b.billing_state, b.billing_country, b.billing_zip,
        b.billing_lat || null, b.billing_lng || null,
        b.shipping_flat, b.shipping_street, b.shipping_city, b.shipping_state, b.shipping_country, b.shipping_zip,
        b.shipping_lat || null, b.shipping_lng || null,
        b.description, b.proposal_amount || b.deal_size || null, b.deal_size || b.proposal_amount || null,
        b.owner_id, req.user.id, req.params.id,
      ]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Account not found' });
    recordOk(res, result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
};

router.put('/:id', requireEdit, updateAccount);
router.patch('/:id', requireEdit, updateAccount);

router.delete('/:id', requireEdit, async (req, res) => {
  try {
    const [c, d] = await Promise.all([
      pool.query(`SELECT COUNT(*) FROM contacts WHERE account_id=$1 AND deleted_at IS NULL`, [req.params.id]),
      pool.query(`SELECT COUNT(*) FROM deals WHERE account_id=$1 AND deleted_at IS NULL`, [req.params.id]),
    ]);
    await softDelete('accounts', req.params.id, req.user.id);
    res.json({ message: 'Account moved to recycle bin', linkedContacts: parseInt(c.rows[0].count), linkedDeals: parseInt(d.rows[0].count) });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
