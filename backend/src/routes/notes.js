const express = require('express');
const pool = require('../db/pool');
const auth = require('../middleware/auth');
const { requireEdit } = require('../middleware/roles');

const router = express.Router();
router.use(auth);

router.get('/', async (req, res) => {
  const { related_type, related_id } = req.query;
  if (!related_type || !related_id) return res.status(400).json({ error: 'related_type and related_id required' });
  try {
    const result = await pool.query(
      `SELECT n.*, u.name as owner_name FROM notes n LEFT JOIN users u ON n.owner_id=u.id
       WHERE n.related_type=$1 AND n.related_id=$2 ORDER BY n.created_at DESC`,
      [related_type, related_id]
    );
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/', requireEdit, async (req, res) => {
  const { content, related_type, related_id } = req.body;
  if (!content || !related_type || !related_id) return res.status(400).json({ error: 'Content and related record required' });
  try {
    const result = await pool.query(
      `INSERT INTO notes (content, related_type, related_id, owner_id) VALUES ($1,$2,$3,$4) RETURNING *`,
      [content, related_type, related_id, req.user.id]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/:id', requireEdit, async (req, res) => {
  try {
    await pool.query(`DELETE FROM notes WHERE id=$1`, [req.params.id]);
    res.json({ message: 'Note deleted' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
