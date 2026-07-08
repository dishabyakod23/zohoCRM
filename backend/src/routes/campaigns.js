const express = require('express');
const pool = require('../db/pool');
const auth = require('../middleware/auth');
const { requireEdit } = require('../middleware/roles');
const { softDelete, parseCSV, listOk, recordOk } = require('../utils/helpers');

const router = express.Router();
router.use(auth);

router.get('/', async (req, res) => {
  try {
    const { search, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;
    let where = ['c.deleted_at IS NULL'];
    const params = [];
    let i = 1;
    if (search) { where.push(`c.name ILIKE $${i}`); params.push(`%${search}%`); i++; }
    const whereStr = 'WHERE ' + where.join(' AND ');
    const result = await pool.query(
      `SELECT c.*, u.name as owner_name,
        (SELECT COUNT(*) FROM campaign_members cm WHERE cm.campaign_id = c.id) as member_count
       FROM campaigns c LEFT JOIN users u ON c.owner_id=u.id
       ${whereStr} ORDER BY c.created_at DESC LIMIT $${i} OFFSET $${i + 1}`,
      [...params, limit, offset]
    );
    const countRes = await pool.query(`SELECT COUNT(*) FROM campaigns c ${whereStr}`, params);
    listOk(res, result.rows, countRes.rows[0].count, page, limit);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/:id', async (req, res) => {
  try {
    const [camp, members] = await Promise.all([
      pool.query(`SELECT c.*, u.name as owner_name FROM campaigns c LEFT JOIN users u ON c.owner_id=u.id WHERE c.id=$1 AND c.deleted_at IS NULL`, [req.params.id]),
      pool.query(`SELECT cm.*,
        CASE
          WHEN cm.member_type='lead' THEN l.first_name || ' ' || l.last_name
          WHEN cm.member_type='account' THEN acc.name
          ELSE ct.first_name || ' ' || ct.last_name
        END as member_name
        FROM campaign_members cm
        LEFT JOIN leads l ON cm.member_type='lead' AND cm.member_id=l.id
        LEFT JOIN contacts ct ON cm.member_type='contact' AND cm.member_id=ct.id
        LEFT JOIN accounts acc ON cm.member_type='account' AND cm.member_id=acc.id
        WHERE cm.campaign_id=$1`, [req.params.id])
    ]);
    if (!camp.rows[0]) return res.status(404).json({ error: 'Campaign not found' });
    recordOk(res, { ...camp.rows[0], members: members.rows });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/', requireEdit, async (req, res) => {
  const { name, type, status, start_date, end_date, expected_revenue, budgeted_cost, actual_cost, expected_response, numbers_sent, description, owner_id } = req.body;
  if (!name || !type || !status || !start_date || !end_date)
    return res.status(400).json({ error: 'Name, type, status, start date, and end date are required' });
  try {
    const result = await pool.query(
      `INSERT INTO campaigns (name, type, status, start_date, end_date, expected_revenue, budgeted_cost, actual_cost, expected_response, numbers_sent, description, owner_id, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,
      [name, type, status, start_date, end_date, expected_revenue, budgeted_cost, actual_cost, expected_response, numbers_sent, description, owner_id || req.user.id, req.user.id]
    );
    recordOk(res, result.rows[0], 201);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

const updateCampaign = async (req, res) => {
  const fields = req.body;
  try {
    const result = await pool.query(
      `UPDATE campaigns SET name=$1, type=$2, status=$3, start_date=$4, end_date=$5, expected_revenue=$6,
       budgeted_cost=$7, actual_cost=$8, expected_response=$9, numbers_sent=$10, description=$11, owner_id=$12, updated_by=$13, updated_at=NOW()
       WHERE id=$14 AND deleted_at IS NULL RETURNING *`,
      [fields.name, fields.type, fields.status, fields.start_date, fields.end_date, fields.expected_revenue,
       fields.budgeted_cost, fields.actual_cost, fields.expected_response, fields.numbers_sent, fields.description,
       fields.owner_id, req.user.id, req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Campaign not found' });
    recordOk(res, result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
};

router.put('/:id', requireEdit, updateCampaign);
router.patch('/:id', requireEdit, updateCampaign);

router.delete('/:id', requireEdit, async (req, res) => {
  try {
    const memberCount = await pool.query(`SELECT COUNT(*) FROM campaign_members WHERE campaign_id=$1`, [req.params.id]);
    await softDelete('campaigns', req.params.id, req.user.id);
    res.json({ message: 'Campaign moved to recycle bin', memberCount: parseInt(memberCount.rows[0].count) });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/:id/members', requireEdit, async (req, res) => {
  const { member_type, member_id } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO campaign_members (campaign_id, member_type, member_id) VALUES ($1,$2,$3)
       ON CONFLICT (campaign_id, member_type, member_id) DO NOTHING RETURNING *`,
      [req.params.id, member_type, member_id]
    );
    res.status(201).json(result.rows[0] || { message: 'Member already exists' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/:id/members/:memberId', requireEdit, async (req, res) => {
  try {
    await pool.query(`DELETE FROM campaign_members WHERE id=$1 AND campaign_id=$2`, [req.params.memberId, req.params.id]);
    res.json({ message: 'Member removed' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/:id/bulk-upload', requireEdit, async (req, res) => {
  const { csv, mapping } = req.body;
  if (!csv) return res.status(400).json({ error: 'CSV data required' });
  try {
    const { rows } = parseCSV(csv);
    const ready = [], errors = [];
    for (const row of rows) {
      const email = row[mapping?.email || 'email'];
      const type = row[mapping?.type || 'type'] || 'contact';
      if (!email) { errors.push({ row: row._row, error: 'Email required' }); continue; }
      const table = type === 'lead' ? 'leads' : 'contacts';
      const found = await pool.query(`SELECT id FROM ${table} WHERE email=$1 AND deleted_at IS NULL`, [email]);
      if (!found.rows[0]) { errors.push({ row: row._row, error: `${type} not found: ${email}` }); continue; }
      ready.push({ member_type: type, member_id: found.rows[0].id, row: row._row });
    }
    res.json({ ready: ready.length, errors: errors.length, readyRecords: ready, errorRecords: errors });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/:id/bulk-import', requireEdit, async (req, res) => {
  const { members } = req.body;
  try {
    let imported = 0, skipped = 0;
    for (const m of members) {
      const r = await pool.query(
        `INSERT INTO campaign_members (campaign_id, member_type, member_id) VALUES ($1,$2,$3)
         ON CONFLICT DO NOTHING RETURNING id`,
        [req.params.id, m.member_type, m.member_id]
      );
      if (r.rows[0]) imported++; else skipped++;
    }
    res.json({ imported, skipped });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
