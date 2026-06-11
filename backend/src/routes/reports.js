const express = require('express');
const pool = require('../db/pool');
const auth = require('../middleware/auth');
const { requireDownload } = require('../middleware/roles');
const { getOwnerFilter } = require('../utils/helpers');

const router = express.Router();
router.use(auth);

async function dateFilter(startDate, endDate, col = 'created_at') {
  if (!startDate && !endDate) return { clause: '', params: [] };
  const params = [];
  let clause = '';
  if (startDate) { clause += ` AND ${col} >= $1`; params.push(startDate); }
  if (endDate) { clause += ` AND ${col} <= $${params.length + 1}`; params.push(endDate); }
  return { clause, params };
}

router.get('/leads-by-source', async (req, res) => {
  try {
    const { start_date, end_date } = req.query;
    const df = await dateFilter(start_date, end_date);
    const result = await pool.query(
      `SELECT COALESCE(source, 'Unknown') as label, COUNT(*) as count FROM leads
       WHERE deleted_at IS NULL ${df.clause} GROUP BY source ORDER BY count DESC`, df.params
    );
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/leads-by-status', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT COALESCE(status, 'None') as label, COUNT(*) as count FROM leads WHERE deleted_at IS NULL GROUP BY status ORDER BY count DESC`
    );
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/leads-by-owner', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT u.name as label, COUNT(l.id) as count FROM leads l
       JOIN users u ON l.owner_id=u.id WHERE l.deleted_at IS NULL GROUP BY u.name ORDER BY count DESC`
    );
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/lead-conversion', async (req, res) => {
  try {
    const [total, converted] = await Promise.all([
      pool.query(`SELECT COUNT(*) FROM leads WHERE deleted_at IS NULL`),
      pool.query(`SELECT COUNT(*) FROM leads WHERE converted=true AND deleted_at IS NULL`),
    ]);
    const t = parseInt(total.rows[0].count);
    const c = parseInt(converted.rows[0].count);
    res.json({ total: t, converted: c, rate: t > 0 ? ((c / t) * 100).toFixed(1) : 0 });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/deals-by-stage', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT stage as label, COUNT(*) as count, COALESCE(SUM(amount),0) as total FROM deals
       WHERE deleted_at IS NULL AND stage NOT IN ('Closed Won','Closed Lost') GROUP BY stage ORDER BY count DESC`
    );
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/deals-won-lost', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT stage as label, COUNT(*) as count, COALESCE(SUM(amount),0) as total FROM deals
       WHERE deleted_at IS NULL AND stage IN ('Closed Won','Closed Lost') GROUP BY stage`
    );
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/deals-closing-month', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT d.*, a.name as account_name FROM deals d LEFT JOIN accounts a ON d.account_id=a.id
       WHERE d.deleted_at IS NULL AND d.close_date >= DATE_TRUNC('month', CURRENT_DATE)
       AND d.close_date < DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month'
       AND d.stage NOT IN ('Closed Won','Closed Lost') ORDER BY d.close_date`
    );
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/accounts-by-industry', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT COALESCE(industry,'Unknown') as label, COUNT(*) as count FROM accounts WHERE deleted_at IS NULL GROUP BY industry ORDER BY count DESC`
    );
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/activity-summary', async (req, res) => {
  try {
    const [tasks, calls, meetings] = await Promise.all([
      pool.query(`SELECT COUNT(*) FROM tasks WHERE status='Completed' AND deleted_at IS NULL`),
      pool.query(`SELECT COUNT(*) FROM calls WHERE deleted_at IS NULL`),
      pool.query(`SELECT COUNT(*) FROM meetings WHERE deleted_at IS NULL`),
    ]);
    res.json({
      tasks_completed: parseInt(tasks.rows[0].count),
      calls_logged: parseInt(calls.rows[0].count),
      meetings_held: parseInt(meetings.rows[0].count),
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/campaign-roi', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT c.name, c.expected_revenue, c.actual_cost,
        (SELECT COUNT(*) FROM campaign_members cm WHERE cm.campaign_id=c.id) as members
       FROM campaigns c WHERE c.deleted_at IS NULL ORDER BY c.created_at DESC`
    );
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/export/:type', requireDownload, async (req, res) => {
  const { type } = req.params;
  const tables = { leads: 'leads', contacts: 'contacts', accounts: 'accounts', deals: 'deals' };
  if (!tables[type]) return res.status(400).json({ error: 'Invalid export type' });
  try {
    const result = await pool.query(`SELECT * FROM ${tables[type]} WHERE deleted_at IS NULL ORDER BY id`);
    const rows = result.rows;
    if (!rows.length) return res.send('');
    const headers = Object.keys(rows[0]).join(',');
    const csv = rows.map(r => Object.values(r).map(v => `"${v ?? ''}"`).join(',')).join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${type}-report.csv"`);
    res.send(headers + '\n' + csv);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/weekly/trigger', async (req, res) => {
  try {
    const { generateWeeklyReport } = require('../jobs/weeklyReport');
    const result = await generateWeeklyReport();
    res.json(result);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
