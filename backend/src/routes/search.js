const express = require('express');
const pool = require('../db/pool');
const auth = require('../middleware/auth');

const router = express.Router();
router.use(auth);

router.get('/', async (req, res) => {
  const { q } = req.query;
  if (!q || q.length < 2) return res.json({ results: [] });
  try {
    const term = `%${q}%`;
    const [leads, contacts, accounts, deals, tasks] = await Promise.all([
      pool.query(`SELECT id, first_name || ' ' || last_name as name, email, 'lead' as type FROM leads WHERE deleted_at IS NULL AND (first_name ILIKE $1 OR last_name ILIKE $1 OR email ILIKE $1 OR company ILIKE $1) LIMIT 5`, [term]),
      pool.query(`SELECT id, first_name || ' ' || last_name as name, email, 'contact' as type FROM contacts WHERE deleted_at IS NULL AND (first_name ILIKE $1 OR last_name ILIKE $1 OR email ILIKE $1) LIMIT 5`, [term]),
      pool.query(`SELECT id, name, industry as subtitle, 'account' as type FROM accounts WHERE deleted_at IS NULL AND name ILIKE $1 LIMIT 5`, [term]),
      pool.query(`SELECT id, name, stage as subtitle, 'deal' as type FROM deals WHERE deleted_at IS NULL AND name ILIKE $1 LIMIT 5`, [term]),
      pool.query(`SELECT id, title as name, status as subtitle, 'task' as type FROM tasks WHERE deleted_at IS NULL AND title ILIKE $1 LIMIT 5`, [term]),
    ]);
    res.json({
      results: [
        ...leads.rows, ...contacts.rows, ...accounts.rows, ...deals.rows, ...tasks.rows,
      ],
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
