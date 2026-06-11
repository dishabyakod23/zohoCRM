const pool = require('../db/pool');

async function generateWeeklyReport() {
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const [newLeads, converted, dealsCreated, dealsWon, dealsLost, pipeline, tasksDone, calls, meetings, overdue] = await Promise.all([
    pool.query(`SELECT COUNT(*) as count, source FROM leads WHERE created_at >= $1 AND deleted_at IS NULL GROUP BY source`, [weekAgo]),
    pool.query(`SELECT COUNT(*) FROM leads WHERE converted_at >= $1`, [weekAgo]),
    pool.query(`SELECT COUNT(*) FROM deals WHERE created_at >= $1 AND deleted_at IS NULL`, [weekAgo]),
    pool.query(`SELECT COUNT(*), COALESCE(SUM(amount),0) as revenue FROM deals WHERE stage='Closed Won' AND updated_at >= $1`, [weekAgo]),
    pool.query(`SELECT COUNT(*) FROM deals WHERE stage='Closed Lost' AND updated_at >= $1`, [weekAgo]),
    pool.query(`SELECT stage, COUNT(*) as count, COALESCE(SUM(amount),0) as total FROM deals WHERE deleted_at IS NULL AND stage NOT IN ('Closed Won','Closed Lost') GROUP BY stage`),
    pool.query(`SELECT COUNT(*) FROM tasks WHERE status='Completed' AND updated_at >= $1`, [weekAgo]),
    pool.query(`SELECT COUNT(*) FROM calls WHERE created_at >= $1`, [weekAgo]),
    pool.query(`SELECT COUNT(*) FROM meetings WHERE created_at >= $1`, [weekAgo]),
    pool.query(`SELECT COUNT(*) FROM tasks WHERE due_date < NOW() AND status != 'Completed' AND deleted_at IS NULL`),
  ]);

  const report = {
    period: weekAgo,
    newLeads: newLeads.rows,
    converted: parseInt(converted.rows[0].count),
    dealsCreated: parseInt(dealsCreated.rows[0].count),
    dealsWon: { count: parseInt(dealsWon.rows[0].count), revenue: dealsWon.rows[0].revenue },
    dealsLost: parseInt(dealsLost.rows[0].count),
    pipeline: pipeline.rows,
    activities: {
      tasks: parseInt(tasksDone.rows[0].count),
      calls: parseInt(calls.rows[0].count),
      meetings: parseInt(meetings.rows[0].count),
    },
    overdueTasks: parseInt(overdue.rows[0].count),
    generatedAt: new Date().toISOString(),
  };

  const recipients = await pool.query(
    `SELECT id, email, name, role FROM users WHERE weekly_report_enabled=true AND role IN ('super_admin','sales_manager') AND deleted_at IS NULL`
  );

  for (const user of recipients.rows) {
    await pool.query(
      `INSERT INTO weekly_report_logs (recipient_email, recipient_id, status) VALUES ($1,$2,'Sent')`,
      [user.email, user.id]
    );
  }

  return { report, recipients: recipients.rows.length, message: 'Weekly report generated (email delivery requires SMTP configuration)' };
}

module.exports = { generateWeeklyReport };
