const express = require('express');
const pool = require('../db/pool');
const auth = require('../middleware/auth');
const { requireAdmin } = require('../middleware/roles');
const { restoreRecord, permanentDelete } = require('../utils/helpers');

const router = express.Router();
router.use(auth);

const TABLES = [
  { table: 'leads', type: 'lead', nameCol: "first_name || ' ' || last_name" },
  { table: 'contacts', type: 'contact', nameCol: "first_name || ' ' || last_name" },
  { table: 'accounts', type: 'account', nameCol: 'name' },
  { table: 'deals', type: 'deal', nameCol: 'name' },
  { table: 'tasks', type: 'task', nameCol: 'title' },
  { table: 'meetings', type: 'meeting', nameCol: 'title' },
  { table: 'calls', type: 'call', nameCol: 'subject' },
  { table: 'campaigns', type: 'campaign', nameCol: 'name' },
  { table: 'documents', type: 'document', nameCol: 'name' },
  { table: 'visits', type: 'visit', nameCol: 'title' },
  { table: 'projects', type: 'project', nameCol: 'name' },
];

router.get('/', async (req, res) => {
  try {
    const results = [];
    for (const { table, type, nameCol } of TABLES) {
      const r = await pool.query(
        `SELECT id, ${nameCol} as name, deleted_at, '${type}' as record_type FROM ${table}
         WHERE deleted_at IS NOT NULL AND deleted_at > NOW() - INTERVAL '30 days'
         ORDER BY deleted_at DESC`
      );
      results.push(...r.rows);
    }
    results.sort((a, b) => new Date(b.deleted_at) - new Date(a.deleted_at));
    res.json(results);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/restore', async (req, res) => {
  const { record_type, id } = req.body;
  const t = TABLES.find(x => x.type === record_type);
  if (!t) return res.status(400).json({ error: 'Invalid record type' });
  try {
    await restoreRecord(t.table, id);
    res.json({ message: 'Record restored' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/permanent', requireAdmin, async (req, res) => {
  const { record_type, id } = req.body;
  const t = TABLES.find(x => x.type === record_type);
  if (!t) return res.status(400).json({ error: 'Invalid record type' });
  try {
    await permanentDelete(t.table, id);
    res.json({ message: 'Record permanently deleted' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
