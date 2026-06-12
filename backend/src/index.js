const cron = require('node-cron');
require('dotenv').config();

const app = require('./app');
const PORT = process.env.PORT || 5000;

if (process.env.ENABLE_WEEKLY_REPORTS !== 'false') {
  cron.schedule('0 8 * * 1', async () => {
    try {
      const { generateWeeklyReport } = require('./jobs/weeklyReport');
      await generateWeeklyReport();
      console.log('📊 Weekly report generated');
    } catch (err) {
      console.error('Weekly report failed:', err.message);
    }
  });
}

app.listen(PORT, () => {
  console.log(`🚀 CRM Backend running on http://localhost:${PORT}`);
});
