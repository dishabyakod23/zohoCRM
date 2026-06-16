const express = require('express');
const pool = require('../db/pool');
const auth = require('../middleware/auth');
const { requireDownload } = require('../middleware/roles');

const router = express.Router();
router.use(auth);

const ok = (res, data) => res.json({ data });

function dateClause(date_from, date_to, col = 'created_at') {
  const params = [];
  let clause = '';
  if (date_from) { clause += ` AND ${col} >= $${params.length + 1}`; params.push(date_from); }
  if (date_to) { clause += ` AND ${col} <= $${params.length + 1}`; params.push(date_to); }
  return { clause, params };
}

/* ── Leads ── */
router.get('/leads', async (req, res) => {
  try {
    const { group_by = 'status', date_from, date_to } = req.query;
    const { clause, params } = dateClause(date_from, date_to);
    let col, label;
    if (group_by === 'source') { col = 'source'; label = 'COALESCE(source,\'Unknown\')'; }
    else if (group_by === 'owner') { col = 'owner_name'; label = 'u.name'; }
    else { col = 'status'; label = 'COALESCE(status,\'None\')'; }
    const q = group_by === 'owner'
      ? `SELECT u.name as label, COUNT(l.id) as count FROM leads l LEFT JOIN users u ON l.owner_id=u.id WHERE l.deleted_at IS NULL ${clause} GROUP BY u.name ORDER BY count DESC`
      : `SELECT ${label} as label, COUNT(*) as count FROM leads WHERE deleted_at IS NULL ${clause} GROUP BY ${col} ORDER BY count DESC`;
    const result = await pool.query(q, params);
    ok(res, result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Legacy aliases
router.get('/leads-by-source', async (req, res) => {
  const result = await pool.query(`SELECT COALESCE(source,'Unknown') as label, COUNT(*) as count FROM leads WHERE deleted_at IS NULL GROUP BY source ORDER BY count DESC`);
  ok(res, result.rows);
});
router.get('/leads-by-status', async (req, res) => {
  const result = await pool.query(`SELECT COALESCE(status,'None') as label, COUNT(*) as count FROM leads WHERE deleted_at IS NULL GROUP BY status ORDER BY count DESC`);
  ok(res, result.rows);
});
router.get('/leads-by-owner', async (req, res) => {
  const result = await pool.query(`SELECT u.name as label, COUNT(l.id) as count FROM leads l JOIN users u ON l.owner_id=u.id WHERE l.deleted_at IS NULL GROUP BY u.name ORDER BY count DESC`);
  ok(res, result.rows);
});

/* ── Lead conversion ── */
router.get('/leads/conversion', async (req, res) => {
  try {
    const { date_from, date_to } = req.query;
    const { clause, params } = dateClause(date_from, date_to);
    const [total, converted] = await Promise.all([
      pool.query(`SELECT COUNT(*) FROM leads WHERE deleted_at IS NULL ${clause}`, params),
      pool.query(`SELECT COUNT(*) FROM leads WHERE converted=true AND deleted_at IS NULL ${clause}`, params),
    ]);
    const t = parseInt(total.rows[0].count);
    const c = parseInt(converted.rows[0].count);
    ok(res, { total: t, converted: c, not_converted: t - c, rate: t > 0 ? ((c / t) * 100).toFixed(1) : 0 });
  } catch (err) { res.status(500).json({ error: err.message }); }
});
router.get('/lead-conversion', async (req, res) => {
  const [total, converted] = await Promise.all([
    pool.query(`SELECT COUNT(*) FROM leads WHERE deleted_at IS NULL`),
    pool.query(`SELECT COUNT(*) FROM leads WHERE converted=true AND deleted_at IS NULL`),
  ]);
  const t = parseInt(total.rows[0].count); const c = parseInt(converted.rows[0].count);
  ok(res, { total: t, converted: c, rate: t > 0 ? ((c / t) * 100).toFixed(1) : 0 });
});

/* ── Deals ── */
router.get('/deals', async (req, res) => {
  try {
    const { group_by = 'stage', date_from, date_to } = req.query;
    const { clause, params } = dateClause(date_from, date_to, 'd.created_at');
    let q;
    if (group_by === 'owner') {
      q = `SELECT u.name as label, COUNT(d.id) as count, COALESCE(SUM(d.amount),0) as total FROM deals d LEFT JOIN users u ON d.owner_id=u.id WHERE d.deleted_at IS NULL ${clause} GROUP BY u.name ORDER BY count DESC`;
    } else {
      q = `SELECT stage as label, COUNT(*) as count, COALESCE(SUM(amount),0) as total FROM deals d WHERE deleted_at IS NULL ${clause} GROUP BY stage ORDER BY count DESC`;
    }
    const result = await pool.query(q, params);
    ok(res, result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});
router.get('/deals-by-stage', async (req, res) => {
  const result = await pool.query(`SELECT stage as label, COUNT(*) as count, COALESCE(SUM(amount),0) as total FROM deals WHERE deleted_at IS NULL GROUP BY stage ORDER BY count DESC`);
  ok(res, result.rows);
});

router.get('/deals/won-lost', async (req, res) => {
  try {
    const { date_from, date_to } = req.query;
    const { clause, params } = dateClause(date_from, date_to, 'd.created_at');
    const result = await pool.query(
      `SELECT stage as label, COUNT(*) as count, COALESCE(SUM(amount),0) as total FROM deals d
       WHERE deleted_at IS NULL AND stage IN ('closed_won','closed_lost','Closed Won','Closed Lost') ${clause} GROUP BY stage`, params
    );
    ok(res, result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});
router.get('/deals-won-lost', async (req, res) => {
  const result = await pool.query(`SELECT stage as label, COUNT(*) as count, COALESCE(SUM(amount),0) as total FROM deals WHERE deleted_at IS NULL AND stage IN ('closed_won','closed_lost','Closed Won','Closed Lost') GROUP BY stage`);
  ok(res, result.rows);
});

router.get('/deals-closing-month', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT d.*, a.name as account_name FROM deals d LEFT JOIN accounts a ON d.account_id=a.id
       WHERE d.deleted_at IS NULL AND d.close_date >= DATE_TRUNC('month', CURRENT_DATE)
       AND d.close_date < DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month'
       AND d.stage NOT IN ('closed_won','closed_lost','Closed Won','Closed Lost') ORDER BY d.close_date`
    );
    ok(res, result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

/* ── Accounts ── */
router.get('/accounts', async (req, res) => {
  try {
    const { group_by = 'industry', date_from, date_to } = req.query;
    const { clause, params } = dateClause(date_from, date_to);
    const col = group_by === 'type' ? 'account_type' : 'industry';
    const result = await pool.query(
      `SELECT COALESCE(${col},'Unknown') as label, COUNT(*) as count FROM accounts WHERE deleted_at IS NULL ${clause} GROUP BY ${col} ORDER BY count DESC`, params
    );
    ok(res, result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});
router.get('/accounts-by-industry', async (req, res) => {
  const result = await pool.query(`SELECT COALESCE(industry,'Unknown') as label, COUNT(*) as count FROM accounts WHERE deleted_at IS NULL GROUP BY industry ORDER BY count DESC`);
  ok(res, result.rows);
});

/* ── Activities ── */
router.get('/activities', async (req, res) => {
  try {
    const [tasks, calls, meetings, visits] = await Promise.all([
      pool.query(`SELECT COUNT(*) FROM tasks WHERE deleted_at IS NULL`),
      pool.query(`SELECT COUNT(*) FROM calls WHERE deleted_at IS NULL`),
      pool.query(`SELECT COUNT(*) FROM meetings WHERE deleted_at IS NULL`),
      pool.query(`SELECT COUNT(*) FROM visits WHERE deleted_at IS NULL`),
    ]);
    ok(res, {
      tasks: parseInt(tasks.rows[0].count),
      calls: parseInt(calls.rows[0].count),
      meetings: parseInt(meetings.rows[0].count),
      visits: parseInt(visits.rows[0].count),
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});
router.get('/activity-summary', async (req, res) => {
  const [tasks, calls, meetings] = await Promise.all([
    pool.query(`SELECT COUNT(*) FROM tasks WHERE status='completed' AND deleted_at IS NULL`),
    pool.query(`SELECT COUNT(*) FROM calls WHERE deleted_at IS NULL`),
    pool.query(`SELECT COUNT(*) FROM meetings WHERE deleted_at IS NULL`),
  ]);
  ok(res, { tasks_completed: parseInt(tasks.rows[0].count), calls_logged: parseInt(calls.rows[0].count), meetings_held: parseInt(meetings.rows[0].count) });
});

/* ── Campaigns ── */
router.get('/campaigns', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT c.name as label, c.expected_revenue, c.actual_cost, c.budgeted_cost,
        (SELECT COUNT(*) FROM campaign_members cm WHERE cm.campaign_id=c.id) as members
       FROM campaigns c WHERE c.deleted_at IS NULL ORDER BY c.created_at DESC`
    );
    ok(res, result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});
router.get('/campaign-roi', async (req, res) => {
  const result = await pool.query(`SELECT c.name, c.expected_revenue, c.actual_cost, (SELECT COUNT(*) FROM campaign_members cm WHERE cm.campaign_id=c.id) as members FROM campaigns c WHERE c.deleted_at IS NULL ORDER BY c.created_at DESC`);
  ok(res, result.rows);
});

/* ── Account revenue ── */
router.get('/account-revenue', async (req, res) => {
  try {
    const result = await pool.query(`SELECT name as label, COALESCE(annual_revenue,0) as revenue FROM accounts WHERE deleted_at IS NULL ORDER BY annual_revenue DESC NULLS LAST LIMIT 10`);
    ok(res, result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

/* ── Export ── */
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

/* ── Weekly report ── */
router.post('/weekly/trigger', async (req, res) => {
  try {
    const { generateWeeklyReport } = require('../jobs/weeklyReport');
    const result = await generateWeeklyReport();
    res.json({ data: result });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
