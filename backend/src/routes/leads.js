const express = require('express');
const pool = require('../db/pool');
const auth = require('../middleware/auth');
const { requireEdit } = require('../middleware/roles');
const { softDelete, parseCSV } = require('../utils/helpers');
const { logAudit, getAuditTrail } = require('../utils/audit');

const router = express.Router();
router.use(auth);

const LEAD_FIELDS = `l.id, l.first_name, l.last_name, l.email, l.phone, l.company, l.source, l.status,
  l.title, l.mobile, l.industry, l.annual_revenue, l.website, l.rating, l.description,
  l.city, l.state, l.country, l.converted, l.owner_id, l.created_at, l.updated_at`;

router.get('/', async (req, res) => {
  try {
    const { search, status, page = 1, limit = 20, industry, source } = req.query;
    const offset = (page - 1) * limit;
    let where = ['l.deleted_at IS NULL'];
    let params = [];
    let i = 1;
    if (search) { where.push(`(l.first_name ILIKE $${i} OR l.last_name ILIKE $${i} OR l.email ILIKE $${i} OR l.company ILIKE $${i})`); params.push(`%${search}%`); i++; }
    if (status) { where.push(`l.status=$${i}`); params.push(status); i++; }
    if (industry) { where.push(`l.industry=$${i}`); params.push(industry); i++; }
    if (source) { where.push(`l.source=$${i}`); params.push(source); i++; }
    const whereStr = 'WHERE ' + where.join(' AND ');
    const result = await pool.query(
      `SELECT ${LEAD_FIELDS}, u.name as owner_name FROM leads l LEFT JOIN users u ON l.owner_id=u.id ${whereStr} ORDER BY l.created_at DESC LIMIT $${i} OFFSET $${i+1}`,
      [...params, limit, offset]
    );
    const countRes = await pool.query(`SELECT COUNT(*) FROM leads l ${whereStr}`, params);
    res.json({ data: result.rows, total: parseInt(countRes.rows[0].count), page: parseInt(page), limit: parseInt(limit) });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/:id/audit', async (req, res) => {
  try {
    res.json(await getAuditTrail('lead', req.params.id));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/:id', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT ${LEAD_FIELDS}, u.name as owner_name FROM leads l LEFT JOIN users u ON l.owner_id=u.id WHERE l.id=$1 AND l.deleted_at IS NULL`,
      [req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Lead not found' });
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/', requireEdit, async (req, res) => {
  const b = req.body;
  if (!b.last_name || !b.company || !b.email || !b.phone || !b.status)
    return res.status(400).json({ error: 'Last name, company, email, phone, and status are required' });
  const dup = await pool.query(`SELECT id FROM leads WHERE email=$1 AND deleted_at IS NULL`, [b.email]);
  if (dup.rows[0]) return res.status(409).json({ error: 'A record with this email already exists', existingId: dup.rows[0].id });
  try {
    const result = await pool.query(
      `INSERT INTO leads (first_name, last_name, email, phone, company, source, status, title, mobile, industry, website, description, city, state, country, owner_id, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17) RETURNING *`,
      [b.first_name, b.last_name, b.email, b.phone, b.company, b.source, b.status || 'Not Contacted',
       b.title, b.mobile, b.industry, b.website, b.description, b.city, b.state, b.country,
       b.owner_id || req.user.id, req.user.id]
    );
    await logAudit({ recordType: 'lead', recordId: result.rows[0].id, action: 'created', userId: req.user.id });
    res.status(201).json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/:id', requireEdit, async (req, res) => {
  const b = req.body;
  try {
    const result = await pool.query(
      `UPDATE leads SET first_name=$1, last_name=$2, email=$3, phone=$4, company=$5, source=$6, status=$7,
       title=$8, mobile=$9, industry=$10, website=$11, description=$12, city=$13, state=$14, country=$15,
       owner_id=$16, updated_by=$17, updated_at=NOW() WHERE id=$18 AND deleted_at IS NULL RETURNING *`,
      [b.first_name, b.last_name, b.email, b.phone, b.company, b.source, b.status,
       b.title, b.mobile, b.industry, b.website, b.description, b.city, b.state, b.country,
       b.owner_id, req.user.id, req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Lead not found' });
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/:id', requireEdit, async (req, res) => {
  try {
    const lead = await pool.query(`SELECT first_name, last_name FROM leads WHERE id=$1`, [req.params.id]);
    await softDelete('leads', req.params.id, req.user.id);
    res.json({ message: 'Lead moved to recycle bin', name: lead.rows[0] ? `${lead.rows[0].first_name} ${lead.rows[0].last_name}` : '' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/:id/convert', requireEdit, async (req, res) => {
  const { create_deal, deal_name, close_date, stage, amount } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const leadRes = await client.query(`SELECT * FROM leads WHERE id=$1 AND deleted_at IS NULL AND converted=false`, [req.params.id]);
    const lead = leadRes.rows[0];
    if (!lead) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Lead not found or already converted' }); }

    const acctRes = await client.query(
      `INSERT INTO accounts (name, phone, website, industry, city, country, owner_id, created_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$7) RETURNING *`,
      [lead.company, lead.phone, lead.website, lead.industry, lead.city, lead.country, lead.owner_id || req.user.id]
    );
    const account = acctRes.rows[0];

    const contactRes = await client.query(
      `INSERT INTO contacts (first_name, last_name, email, phone, mobile, title, account_id, lead_source, owner_id, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$9) RETURNING *`,
      [lead.first_name, lead.last_name, lead.email, lead.phone, lead.mobile, lead.title, account.id, lead.source, lead.owner_id || req.user.id]
    );
    const contact = contactRes.rows[0];

    let deal = null;
    if (create_deal) {
      if (!close_date || !stage) { await client.query('ROLLBACK'); return res.status(400).json({ error: 'Closing date and stage required for deal' }); }
      const dealRes = await client.query(
        `INSERT INTO deals (name, amount, stage, close_date, account_id, contact_id, owner_id, lead_source, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
        [deal_name || `${lead.company} - Deal`, amount || 0, stage, close_date, account.id, contact.id, lead.owner_id || req.user.id, lead.source, req.user.id]
      );
      deal = dealRes.rows[0];
    }

    await client.query(`UPDATE leads SET converted=true, converted_at=NOW(), status='Contacted', updated_at=NOW() WHERE id=$1`, [lead.id]);
    await client.query('COMMIT');
    res.json({ account, contact, deal, message: 'Lead converted successfully' });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

router.post('/bulk-upload', requireEdit, async (req, res) => {
  const { csv, mapping } = req.body;
  if (!csv) return res.status(400).json({ error: 'CSV data required' });
  try {
    const { rows } = parseCSV(csv);
    const ready = [], errors = [];
    for (const row of rows) {
      const last_name = row[mapping?.last_name || 'last_name'];
      const company = row[mapping?.company || 'company'];
      const email = row[mapping?.email || 'email'];
      const phone = row[mapping?.phone || 'phone'];
      if (!last_name || !company || !email || !phone)
        { errors.push({ row: row._row, error: 'Missing mandatory fields' }); continue; }
      const dup = await pool.query(`SELECT id FROM leads WHERE email=$1 AND deleted_at IS NULL`, [email]);
      if (dup.rows[0]) { errors.push({ row: row._row, error: `Duplicate email: ${email}`, existingId: dup.rows[0].id }); continue; }
      ready.push({ ...row, last_name, company, email, phone });
    }
    res.json({ ready: ready.length, errors: errors.length, readyRecords: ready, errorRecords: errors });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/bulk-import', requireEdit, async (req, res) => {
  const { records } = req.body;
  try {
    let imported = 0;
    for (const r of records) {
      await pool.query(
        `INSERT INTO leads (first_name, last_name, email, phone, company, source, status, owner_id, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$8)`,
        [r.first_name || '', r.last_name, r.email, r.phone, r.company, r.source || 'Website', r.status || 'Not Contacted', req.user.id]
      );
      imported++;
    }
    res.json({ imported });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/bulk-delete', requireEdit, async (req, res) => {
  const { ids } = req.body;
  try {
    for (const id of ids) await softDelete('leads', id, req.user.id);
    res.json({ message: `${ids.length} leads moved to recycle bin` });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
