const express = require('express');
const pool = require('../db/pool');
const auth = require('../middleware/auth');
const { requireEdit } = require('../middleware/roles');
const { softDelete, listOk, recordOk } = require('../utils/helpers');

const router = express.Router();
router.use(auth);

const STAGES = [
  { value: 'qualification', label: 'Qualification' },
  { value: 'needs_analysis', label: 'Needs Analysis' },
  { value: 'value_proposition', label: 'Value Proposition' },
  { value: 'identify_decision_makers', label: 'Id. Decision Makers' },
  { value: 'perception_analysis', label: 'Perception Analysis' },
  { value: 'proposal_price_quote', label: 'Proposal / Price Quote' },
  { value: 'negotiation_review', label: 'Negotiation / Review' },
  { value: 'closed_won', label: 'Closed Won' },
  { value: 'closed_lost', label: 'Closed Lost' },
];

router.get('/', async (req, res) => {
  try {
    const { search, stage, page = 1, page_size = 50, limit } = req.query;
    const pageLimit = parseInt(limit || page_size);
    const offset = (page - 1) * pageLimit;
    let where = ['d.deleted_at IS NULL'];
    let params = [];
    let i = 1;
    if (search) { where.push(`d.name ILIKE $${i}`); params.push(`%${search}%`); i++; }
    if (stage) { where.push(`d.stage=$${i}`); params.push(stage); i++; }
    const whereStr = 'WHERE ' + where.join(' AND ');
    const result = await pool.query(
      `SELECT d.*, u.name as owner_name, a.name as account_name FROM deals d
       LEFT JOIN users u ON d.owner_id=u.id LEFT JOIN accounts a ON d.account_id=a.id
       ${whereStr} ORDER BY d.created_at DESC LIMIT $${i} OFFSET $${i+1}`,
      [...params, pageLimit, offset]
    );
    const countRes = await pool.query(`SELECT COUNT(*) FROM deals d ${whereStr}`, params);
    listOk(res, result.rows, countRes.rows[0].count, page, pageLimit);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/pipeline', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT stage, COUNT(*) as count, COALESCE(SUM(amount),0) as total FROM deals
       WHERE deleted_at IS NULL GROUP BY stage ORDER BY count DESC`
    );
    res.json({ data: result.rows });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/stages', (_, res) => res.json({ data: STAGES }));

router.get('/:id', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT d.*, u.name as owner_name, a.name as account_name, c.first_name || ' ' || c.last_name as contact_name
       FROM deals d LEFT JOIN users u ON d.owner_id=u.id LEFT JOIN accounts a ON d.account_id=a.id
       LEFT JOIN contacts c ON d.contact_id=c.id WHERE d.id=$1 AND d.deleted_at IS NULL`, [req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Deal not found' });
    recordOk(res, result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/', requireEdit, async (req, res) => {
  const b = req.body;
  const dealName = b.deal_name || b.name;
  const closeDate = b.closing_date || b.close_date;
  if (!dealName || !b.account_id || !closeDate || !b.stage || !b.amount)
    return res.status(400).json({ error: 'Deal name, account, closing date, stage, and amount are required' });
  try {
    const result = await pool.query(
      `INSERT INTO deals (name, amount, stage, close_date, probability, account_id, contact_id, deal_type, lead_source, description, proposal_amount, owner_id, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,
      [dealName, b.amount, b.stage, closeDate, b.probability || 10, b.account_id, b.contact_id || null, b.deal_type, b.lead_source, b.description, b.proposal_amount || null, b.owner_id || req.user.id, req.user.id]
    );
    recordOk(res, result.rows[0], 201);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

const updateDeal = async (req, res) => {
  const b = req.body;
  const dealName = b.deal_name || b.name;
  const closeDate = b.closing_date || b.close_date;
  try {
    const result = await pool.query(
      `UPDATE deals SET name=$1, amount=$2, stage=$3, close_date=$4, probability=$5, account_id=$6, contact_id=$7,
       deal_type=$8, lead_source=$9, description=$10, proposal_amount=$11, owner_id=$12, updated_by=$13, updated_at=NOW()
       WHERE id=$14 AND deleted_at IS NULL RETURNING *`,
      [dealName, b.amount, b.stage, closeDate, b.probability, b.account_id, b.contact_id || null, b.deal_type, b.lead_source, b.description, b.proposal_amount || null, b.owner_id, req.user.id, req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Deal not found' });
    recordOk(res, result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
};

router.put('/:id', requireEdit, updateDeal);
router.patch('/:id', requireEdit, updateDeal);

router.patch('/:id/stage', requireEdit, async (req, res) => {
  const { stage, stage_value } = req.body;
  try {
    const result = await pool.query(
      `UPDATE deals SET stage=$1, updated_by=$2, updated_at=NOW() WHERE id=$3 AND deleted_at IS NULL RETURNING *`,
      [stage || stage_value, req.user.id, req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Deal not found' });
    recordOk(res, result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/:id', requireEdit, async (req, res) => {
  try {
    await softDelete('deals', req.params.id, req.user.id);
    res.json({ message: 'Deal moved to recycle bin' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
