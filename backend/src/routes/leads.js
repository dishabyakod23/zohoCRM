const express = require('express');
const pool = require('../db/pool');
const auth = require('../middleware/auth');
const { requireEdit } = require('../middleware/roles');
const { softDelete, parseCSV, listOk, recordOk } = require('../utils/helpers');
const { logAudit, getAuditTrail } = require('../utils/audit');

const router = express.Router();
router.use(auth);

const LEAD_FIELDS = `l.id, l.first_name, l.last_name, l.email, l.phone, l.company,
  l.source, l.source as lead_source, l.status, l.status as lead_status,
  l.title, l.mobile, l.industry, l.annual_revenue, l.website, l.rating, l.description,
  l.employees, l.employees as no_of_employees, l.street, l.city, l.state, l.country,
  l.zip, l.zip as zip_code, l.converted, l.owner_id, l.created_at, l.updated_at`;

router.get('/', async (req, res) => {
  try {
    const { search, status, lead_status, page = 1, page_size = 20, limit, industry, source } = req.query;
    const pageLimit = parseInt(limit || page_size);
    const offset = (page - 1) * pageLimit;
    let where = ['l.deleted_at IS NULL'];
    let params = [];
    let i = 1;
    if (search) { where.push(`(l.first_name ILIKE $${i} OR l.last_name ILIKE $${i} OR l.email ILIKE $${i} OR l.company ILIKE $${i})`); params.push(`%${search}%`); i++; }
    if (status || lead_status) { where.push(`l.status=$${i}`); params.push(status || lead_status); i++; }
    if (industry) { where.push(`l.industry=$${i}`); params.push(industry); i++; }
    if (source) { where.push(`l.source=$${i}`); params.push(source); i++; }
    const whereStr = 'WHERE ' + where.join(' AND ');
    const result = await pool.query(
      `SELECT ${LEAD_FIELDS}, u.name as owner_name FROM leads l LEFT JOIN users u ON l.owner_id=u.id ${whereStr} ORDER BY l.created_at DESC LIMIT $${i} OFFSET $${i+1}`,
      [...params, pageLimit, offset]
    );
    const countRes = await pool.query(`SELECT COUNT(*) FROM leads l ${whereStr}`, params);
    listOk(res, result.rows, countRes.rows[0].count, page, pageLimit);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/:id/audit', async (req, res) => {
  try {
    res.json({ data: await getAuditTrail('lead', req.params.id) });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/:id/notes', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT n.*, u.name as owner_name FROM notes n LEFT JOIN users u ON n.owner_id=u.id
       WHERE n.related_type='lead' AND n.related_id=$1 ORDER BY n.created_at DESC`,
      [req.params.id]
    );
    res.json({ data: result.rows.map((row) => ({ ...row, body: row.content })) });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/:id/notes', requireEdit, async (req, res) => {
  try {
    const { body } = req.body;
    const result = await pool.query(
      `INSERT INTO notes (content, related_type, related_id, owner_id) VALUES ($1,'lead',$2,$3) RETURNING *`,
      [body, req.params.id, req.user.id]
    );
    const row = result.rows[0];
    recordOk(res, { ...row, body: row.content }, 201);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.patch('/:id/notes/:noteId', requireEdit, async (req, res) => {
  try {
    const { body } = req.body;
    const result = await pool.query(
      `UPDATE notes SET content=$1, updated_at=NOW() WHERE id=$2 AND related_type='lead' AND related_id=$3 RETURNING *`,
      [body, req.params.noteId, req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Note not found' });
    const row = result.rows[0];
    recordOk(res, { ...row, body: row.content });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/:id/notes/:noteId', requireEdit, async (req, res) => {
  try {
    await pool.query(`DELETE FROM notes WHERE id=$1 AND owner_id=$2`, [req.params.noteId, req.user.id]);
    res.json({ message: 'Note deleted' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/:id/attachments', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, name, file_type, file_size, created_at FROM documents WHERE related_type='lead' AND related_id=$1 AND deleted_at IS NULL`,
      [req.params.id]
    );
    res.json({ data: result.rows });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/:id', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT ${LEAD_FIELDS}, u.name as owner_name FROM leads l LEFT JOIN users u ON l.owner_id=u.id WHERE l.id=$1 AND l.deleted_at IS NULL`,
      [req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Lead not found' });
    recordOk(res, result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/mass-update', requireEdit, async (req, res) => {
  try {
    const { ids, field, value } = req.body;
    if (!Array.isArray(ids) || ids.length === 0 || !field || value === undefined) {
      return res.status(400).json({ error: 'ids (array), field, and value are required' });
    }
    const FIELD_MAP = {
      status: 'status',
      lead_status: 'status',
      source: 'source',
      industry: 'industry',
      rating: 'rating',
    };
    const col = FIELD_MAP[field];
    if (!col) return res.status(400).json({ error: `Field "${field}" cannot be mass-updated` });
    const placeholders = ids.map((_, i) => `$${i + 2}`).join(',');
    await pool.query(
      `UPDATE leads SET ${col} = $1, updated_at = NOW() WHERE id IN (${placeholders}) AND deleted_at IS NULL`,
      [value, ...ids]
    );
    res.json({ data: { updated: ids.length } });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/', requireEdit, async (req, res) => {
  const b = req.body;
  const status = b.status || b.lead_status;
  const source = b.source || b.lead_source;
  if (!b.first_name || !b.last_name || !b.company || !b.email || !status)
    return res.status(400).json({ error: 'First name, last name, company, email, and status are required' });
  const dup = await pool.query(`SELECT id FROM leads WHERE email=$1 AND deleted_at IS NULL`, [b.email]);
  if (dup.rows[0]) return res.status(409).json({ error: 'A record with this email already exists', existingId: dup.rows[0].id });
  try {
    const result = await pool.query(
      `INSERT INTO leads (first_name, last_name, email, phone, company, source, status, title, mobile, industry,
        website, rating, annual_revenue, employees, street, city, state, country, zip, description, proposal_amount, owner_id, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23) RETURNING *`,
      [b.first_name, b.last_name, b.email, b.phone || null, b.company, source, status || 'not_contacted',
       b.title, b.mobile, b.industry, b.website, b.rating, b.annual_revenue,
       b.no_of_employees || b.employees, b.street, b.city, b.state, b.country,
       b.zip_code || b.zip, b.description, b.proposal_amount || null, b.owner_id || req.user.id, req.user.id]
    );
    await logAudit({ recordType: 'lead', recordId: result.rows[0].id, action: 'created', userId: req.user.id });
    recordOk(res, result.rows[0], 201);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

const updateLead = async (req, res) => {
  const b = req.body;
  const status = b.status || b.lead_status;
  const source = b.source || b.lead_source;
  try {
    const result = await pool.query(
      `UPDATE leads SET first_name=$1, last_name=$2, email=$3, phone=$4, company=$5, source=$6, status=$7,
       title=$8, mobile=$9, industry=$10, website=$11, rating=$12, annual_revenue=$13, employees=$14,
       street=$15, city=$16, state=$17, country=$18, zip=$19, description=$20, proposal_amount=$21,
       owner_id=$22, updated_by=$23, updated_at=NOW() WHERE id=$24 AND deleted_at IS NULL RETURNING *`,
      [b.first_name, b.last_name, b.email, b.phone, b.company, source, status,
       b.title, b.mobile, b.industry, b.website, b.rating, b.annual_revenue,
       b.no_of_employees || b.employees, b.street, b.city, b.state, b.country,
       b.zip_code || b.zip, b.description, b.proposal_amount || null, b.owner_id, req.user.id, req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Lead not found' });
    recordOk(res, result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
};

router.put('/:id', requireEdit, updateLead);
router.patch('/:id', requireEdit, updateLead);

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
    res.json({ data: { account, contact, deal }, message: 'Lead converted successfully' });
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
      const first_name = row[mapping?.first_name || 'first_name'];
      const last_name = row[mapping?.last_name || 'last_name'];
      const company = row[mapping?.company || 'company'];
      const email = row[mapping?.email || 'email'];
      const phone = row[mapping?.phone || 'phone'];
      if (!first_name || !last_name || !company || !email)
        { errors.push({ row: row._row, error: 'Missing mandatory fields' }); continue; }
      const dup = await pool.query(`SELECT id FROM leads WHERE email=$1 AND deleted_at IS NULL`, [email]);
      if (dup.rows[0]) { errors.push({ row: row._row, error: `Duplicate email: ${email}`, existingId: dup.rows[0].id }); continue; }
      ready.push({ ...row, first_name, last_name, company, email, phone: phone || null });
    }
    res.json({ data: { ready: ready.length, errors: errors.length, readyRecords: ready, errorRecords: errors } });
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
        [r.first_name || '', r.last_name, r.email, r.phone, r.company, r.source || 'Website', r.status || 'not_contacted', req.user.id]
      );
      imported++;
    }
    res.json({ data: { imported } });
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
