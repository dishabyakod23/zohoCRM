const express = require('express');
const pool = require('../db/pool');
const auth = require('../middleware/auth');
const { normalizeRole, ROLES } = require('../utils/helpers');

const router = express.Router();
router.use(auth);

const dashboardHandler = async (req, res) => {
  try {
    const role = normalizeRole(req.user.role);
    const ownerFilter = role === ROLES.SALES_REP ? `AND owner_id = ${req.user.id}` : '';

    const [leads, deals, contacts, pipeline, activities, tasksDue, tasksOverdue, leadsByStatus, topAccounts, closingMonth] = await Promise.all([
      pool.query(`SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '30 days') as this_month FROM leads WHERE deleted_at IS NULL ${ownerFilter}`),
      pool.query(`SELECT COUNT(*) as total_deals, COALESCE(SUM(amount),0) as pipeline_value,
        COUNT(*) FILTER (WHERE stage='Closed Won') as won,
        COUNT(*) FILTER (WHERE stage NOT IN ('Closed Won','Closed Lost')) as open_deals,
        COALESCE(SUM(amount) FILTER (WHERE stage NOT IN ('Closed Won','Closed Lost')),0) as open_value
        FROM deals WHERE deleted_at IS NULL ${ownerFilter}`),
      pool.query(`SELECT COUNT(*) as total FROM contacts WHERE deleted_at IS NULL ${ownerFilter}`),
      pool.query(`SELECT stage, COUNT(*) as count, COALESCE(SUM(amount),0) as total FROM deals WHERE deleted_at IS NULL ${ownerFilter} GROUP BY stage ORDER BY count DESC`),
      pool.query(`SELECT 'task' as type, t.title as subject, t.created_at, u.name as owner_name FROM tasks t LEFT JOIN users u ON t.owner_id=u.id WHERE t.deleted_at IS NULL ORDER BY t.created_at DESC LIMIT 5`),
      pool.query(`SELECT COUNT(*) as count FROM tasks WHERE deleted_at IS NULL AND due_date::date = CURRENT_DATE AND status != 'Completed' ${ownerFilter.replace('owner_id', 'assigned_to')}`),
      pool.query(`SELECT COUNT(*) as count FROM tasks WHERE deleted_at IS NULL AND due_date < NOW() AND status != 'Completed' ${ownerFilter.replace('owner_id', 'assigned_to')}`),
      pool.query(`SELECT COALESCE(status,'None') as status, COUNT(*) as count FROM leads WHERE deleted_at IS NULL ${ownerFilter} GROUP BY status`),
      pool.query(`SELECT a.id, a.name as account_name, COALESCE(a.annual_revenue,0) as annual_revenue, COALESCE(a.currency,'INR') as currency FROM accounts a WHERE a.deleted_at IS NULL ORDER BY a.annual_revenue DESC NULLS LAST LIMIT 5`),
      pool.query(`SELECT COUNT(*) as count, COALESCE(SUM(amount),0) as value FROM deals WHERE deleted_at IS NULL
        AND close_date >= DATE_TRUNC('month', CURRENT_DATE) AND close_date < DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month'
        AND stage NOT IN ('Closed Won','Closed Lost') ${ownerFilter}`),
    ]);

    res.json({ data: {
      leads: leads.rows[0],
      deals: deals.rows[0],
      contacts: contacts.rows[0],
      pipeline: pipeline.rows,
      recentActivities: activities.rows,
      tasksDueToday: parseInt(tasksDue.rows[0].count),
      tasksOverdue: parseInt(tasksOverdue.rows[0].count),
      leadsByStatus: leadsByStatus.rows,
      topAccounts: topAccounts.rows,
      dealsClosingMonth: closingMonth.rows[0],
    }});
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

router.get('/stats', dashboardHandler);
router.get('/home', dashboardHandler);

module.exports = router;
