const express = require('express');
const cors = require('cors');
const path = require('path');
const cron = require('node-cron');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors({ origin: ['http://localhost:3000', 'http://localhost:3003'], credentials: true }));
app.use(express.json({ limit: '6mb' }));

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/leads', require('./routes/leads'));
app.use('/api/contacts', require('./routes/contacts'));
app.use('/api/deals', require('./routes/deals'));
app.use('/api/accounts', require('./routes/accounts'));
app.use('/api/dashboard', require('./routes/dashboard'));
app.use('/api/tasks', require('./routes/tasks'));
app.use('/api/meetings', require('./routes/meetings'));
app.use('/api/calls', require('./routes/calls'));
app.use('/api/campaigns', require('./routes/campaigns'));
app.use('/api/documents', require('./routes/documents'));
app.use('/api/visits', require('./routes/visits'));
app.use('/api/projects', require('./routes/projects'));
app.use('/api/reports', require('./routes/reports'));
app.use('/api/search', require('./routes/search'));
app.use('/api/recycle', require('./routes/recycle'));
app.use('/api/notes', require('./routes/notes'));
app.use('/api/users', require('./routes/users'));

app.get('/api/health', (req, res) => res.json({ status: 'ok', time: new Date() }));

// Weekly report scheduler - every Monday at 8:00 AM
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
