const { sendWeeklyReport, buildWeeklyReportPreview } = require('../services/weeklyReportBuilder');

async function generateWeeklyReport() {
  return sendWeeklyReport({ triggerType: 'scheduled' });
}

module.exports = { generateWeeklyReport, buildWeeklyReportPreview, sendWeeklyReport };
