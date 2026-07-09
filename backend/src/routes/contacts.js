const express = require('express');
const pool = require('../db/pool');
const auth = require('../middleware/auth');
const { requireEdit } = require('../middleware/roles');
const { softDelete, parseCSV, listOk, recordOk, DEFAULT_PAGE_SIZE } = require('../utils/helpers');

const router = express.Router();
router.use(auth);

router.get('/', async (req, res) => {
  try {
    const { search, page = 1, page_size = DEFAULT_PAGE_SIZE, limit } = req.query;
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
  if (!b.last_name || !b.account_id || !b.email)
    return res.status(400).json({ error: 'Last name, account, and email are required' });
  const dup = await pool.query(`SELECT id FROM contacts WHERE email=$1 AND deleted_at IS NULL`, [b.email]);
  const dupLead = await pool.query(`SELECT id FROM leads WHERE email=$1 AND deleted_at IS NULL`, [b.email]);
  if (dup.rows[0] || dupLead.rows[0]) {
    return res.status(409).json({
      error: 'A record with this email already exists',
      existingId: dup.rows[0]?.id || dupLead.rows[0]?.id,
    });
  }
  try {
    const result = await pool.query(
      `INSERT INTO contacts (
        salutation, first_name, last_name, email, phone, other_phone, home_phone, mobile, fax,
        secondary_email, skype_id, twitter, email_opt_out,
        title, department, account_id, lead_source, reports_to_id,
        assistant, asst_phone, date_of_birth, website,
        mailing_flat, mailing_street, mailing_city, mailing_state, mailing_country, mailing_zip, mailing_lat, mailing_lng,
        other_flat, other_street, other_city, other_state, other_country, other_zip, other_lat, other_lng,
        description, proposal_amount, company, owner_id, created_by
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,
        $23,$24,$25,$26,$27,$28,$29,$30,$31,$32,$33,$34,$35,$36,$37,$38,$39,$40,$41,$42,$43
      ) RETURNING *`,
      [
        b.salutation, b.first_name, b.last_name, b.email, b.phone || null, b.other_phone, b.home_phone, b.mobile, b.fax,
        b.secondary_email, b.skype_id, b.twitter, b.email_opt_out || false,
        b.title, b.department, b.account_id, b.lead_source, b.reports_to_id || null,
        b.assistant, b.asst_phone, b.date_of_birth || null, b.website,
        b.mailing_flat, b.mailing_street, b.mailing_city, b.mailing_state, b.mailing_country, b.mailing_zip,
        b.mailing_lat || null, b.mailing_lng || null,
        b.other_flat, b.other_street, b.other_city, b.other_state, b.other_country, b.other_zip,
        b.other_lat || null, b.other_lng || null,
        b.description, b.proposal_amount || null, b.company, b.owner_id || req.user.id, req.user.id,
      ]
    );
    recordOk(res, result.rows[0], 201);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

const updateContact = async (req, res) => {
  const b = req.body;
  if (b.email) {
    const dupContact = await pool.query(
      `SELECT id FROM contacts WHERE email=$1 AND deleted_at IS NULL AND id != $2`,
      [b.email, req.params.id],
    );
    const dupLead = await pool.query(
      `SELECT id FROM leads WHERE email=$1 AND deleted_at IS NULL`,
      [b.email],
    );
    if (dupContact.rows[0] || dupLead.rows[0]) {
      return res.status(409).json({
        error: 'A record with this email already exists',
        existingId: dupContact.rows[0]?.id || dupLead.rows[0]?.id,
      });
    }
  }
  try {
    const result = await pool.query(
      `UPDATE contacts SET
        salutation=$1, first_name=$2, last_name=$3, email=$4, phone=$5, other_phone=$6, home_phone=$7, mobile=$8, fax=$9,
        secondary_email=$10, skype_id=$11, twitter=$12, email_opt_out=$13,
        title=$14, department=$15, account_id=$16, lead_source=$17, reports_to_id=$18,
        assistant=$19, asst_phone=$20, date_of_birth=$21, website=$22,
        mailing_flat=$23, mailing_street=$24, mailing_city=$25, mailing_state=$26, mailing_country=$27, mailing_zip=$28, mailing_lat=$29, mailing_lng=$30,
        other_flat=$31, other_street=$32, other_city=$33, other_state=$34, other_country=$35, other_zip=$36, other_lat=$37, other_lng=$38,
        description=$39, proposal_amount=$40, owner_id=$41, updated_by=$42, updated_at=NOW()
       WHERE id=$43 AND deleted_at IS NULL RETURNING *`,
      [
        b.salutation, b.first_name, b.last_name, b.email, b.phone, b.other_phone, b.home_phone, b.mobile, b.fax,
        b.secondary_email, b.skype_id, b.twitter, b.email_opt_out || false,
        b.title, b.department, b.account_id, b.lead_source, b.reports_to_id || null,
        b.assistant, b.asst_phone, b.date_of_birth || null, b.website,
        b.mailing_flat, b.mailing_street, b.mailing_city, b.mailing_state, b.mailing_country, b.mailing_zip,
        b.mailing_lat || null, b.mailing_lng || null,
        b.other_flat, b.other_street, b.other_city, b.other_state, b.other_country, b.other_zip,
        b.other_lat || null, b.other_lng || null,
        b.description, b.proposal_amount || null, b.owner_id, req.user.id, req.params.id,
      ]
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
      if (!last_name || !email || !account_name) { errors.push({ row: row._row, error: 'Missing mandatory fields' }); continue; }
      const acct = await pool.query(`SELECT id FROM accounts WHERE name ILIKE $1 AND deleted_at IS NULL`, [account_name]);
      if (!acct.rows[0]) { errors.push({ row: row._row, error: `Account not found: ${account_name}` }); continue; }
      ready.push({ ...row, last_name, email, phone: phone || null, account_id: acct.rows[0].id });
    }
    res.json({ data: { ready: ready.length, errors: errors.length, readyRecords: ready, errorRecords: errors } });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
