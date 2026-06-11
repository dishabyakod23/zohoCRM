const express = require('express');
const pool = require('../db/pool');
const auth = require('../middleware/auth');
const { requireEdit } = require('../middleware/roles');
const { softDelete } = require('../utils/helpers');

const router = express.Router();
router.use(auth);

const STAGES = ['Qualification', 'Needs Analysis', 'Value Proposition', 'Id. Decision Makers', 'Perception Analysis', 'Proposal / Price Quote', 'Negotiation / Review', 'Closed Won', 'Closed Lost'];

router.get('/', async (req, res) => {
  try {
    const { search, stage, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;
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
      [...params, limit, offset]
    );
    const countRes = await pool.query(`SELECT COUNT(*) FROM deals d ${whereStr}`, params);
    res.json({ data: result.rows, total: parseInt(countRes.rows[0].count), page: parseInt(page), limit: parseInt(limit) });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/pipeline', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT stage, COUNT(*) as count, COALESCE(SUM(amount),0) as total FROM deals
       WHERE deleted_at IS NULL GROUP BY stage ORDER BY count DESC`
    );
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/stages', (_, res) => res.json(STAGES));

router.get('/:id', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT d.*, u.name as owner_name, a.name as account_name, c.first_name || ' ' || c.last_name as contact_name
       FROM deals d LEFT JOIN users u ON d.owner_id=u.id LEFT JOIN accounts a ON d.account_id=a.id
       LEFT JOIN contacts c ON d.contact_id=c.id WHERE d.id=$1 AND d.deleted_at IS NULL`, [req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Deal not found' });
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/', requireEdit, async (req, res) => {
  const b = req.body;
  if (!b.name || !b.account_id || !b.close_date || !b.stage || !b.amount)
    return res.status(400).json({ error: 'Deal name, account, closing date, stage, and amount are required' });
  try {
    const result = await pool.query(
      `INSERT INTO deals (name, amount, stage, close_date, probability, account_id, contact_id, deal_type, lead_source, description, owner_id, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
      [b.name, b.amount, b.stage, b.close_date, b.probability || 10, b.account_id, b.contact_id, b.deal_type, b.lead_source, b.description, b.owner_id || req.user.id, req.user.id]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/:id', requireEdit, async (req, res) => {
  const b = req.body;
  try {
    const result = await pool.query(
      `UPDATE deals SET name=$1, amount=$2, stage=$3, close_date=$4, probability=$5, account_id=$6, contact_id=$7,
       deal_type=$8, lead_source=$9, description=$10, owner_id=$11, updated_by=$12, updated_at=NOW()
       WHERE id=$13 AND deleted_at IS NULL RETURNING *`,
      [b.name, b.amount, b.stage, b.close_date, b.probability, b.account_id, b.contact_id, b.deal_type, b.lead_source, b.description, b.owner_id, req.user.id, req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Deal not found' });
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.patch('/:id/stage', requireEdit, async (req, res) => {
  const { stage } = req.body;
  try {
    const result = await pool.query(
      `UPDATE deals SET stage=$1, updated_by=$2, updated_at=NOW() WHERE id=$3 AND deleted_at IS NULL RETURNING *`,
      [stage, req.user.id, req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Deal not found' });
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/:id', requireEdit, async (req, res) => {
  try {
    await softDelete('deals', req.params.id, req.user.id);
    res.json({ message: 'Deal moved to recycle bin' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
