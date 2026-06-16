const express = require('express');
const pool = require('../db/pool');
const auth = require('../middleware/auth');
const { requireEdit } = require('../middleware/roles');
const { listOk } = require('../utils/helpers');

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
  { table: 'visits', type: 'visit', nameCol: 'title' },
  { table: 'projects', type: 'project', nameCol: 'name' },
];

router.get('/', async (req, res) => {
  try {
    const { entity_type, page = 1, page_size = 50 } = req.query;
    const results = [];
    for (const { table, type, nameCol } of TABLES) {
      if (entity_type && entity_type !== type) continue;
      const r = await pool.query(
        `SELECT id, ${nameCol} as entity_name, deleted_at, '${type}' as entity_type FROM ${table}
         WHERE deleted_at IS NOT NULL AND deleted_at > NOW() - INTERVAL '30 days'
         ORDER BY deleted_at DESC`
      );
      results.push(...r.rows.map((row, i) => ({ ...row, _composite_id: `${type}_${row.id}` })));
    }
    results.sort((a, b) => new Date(b.deleted_at) - new Date(a.deleted_at));
    const total = results.length;
    const start = (page - 1) * page_size;
    const paged = results.slice(start, start + parseInt(page_size));
    listOk(res, paged, total, page, page_size);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/:compositeId/restore', requireEdit, async (req, res) => {
  const [type, id] = req.params.compositeId.split('_');
  const t = TABLES.find(x => x.type === type);
  if (!t) return res.status(400).json({ error: 'Invalid record type' });
  try {
    await pool.query(`UPDATE ${t.table} SET deleted_at=NULL WHERE id=$1`, [id]);
    res.json({ message: 'Record restored' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/:compositeId', requireEdit, async (req, res) => {
  const [type, id] = req.params.compositeId.split('_');
  const t = TABLES.find(x => x.type === type);
  if (!t) return res.status(400).json({ error: 'Invalid record type' });
  try {
    await pool.query(`DELETE FROM ${t.table} WHERE id=$1`, [id]);
    res.json({ message: 'Record permanently deleted' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
