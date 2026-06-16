const express = require('express');
const pool = require('../db/pool');
const auth = require('../middleware/auth');
const { listOk } = require('../utils/helpers');

const router = express.Router();
router.use(auth);

router.get('/', async (req, res) => {
  try {
    const { page = 1, limit = 50, page_size, entity_type, action } = req.query;
    const pageLimit = parseInt(page_size || limit);
    const offset = (page - 1) * pageLimit;
    let where = [];
    let params = [];
    let i = 1;
    if (entity_type) { where.push(`a.record_type=$${i}`); params.push(entity_type); i++; }
    if (action) { where.push(`a.action=$${i}`); params.push(action); i++; }
    const whereStr = where.length ? 'WHERE ' + where.join(' AND ') : '';
    const result = await pool.query(
      `SELECT a.*, u.name as user_name FROM audit_log a LEFT JOIN users u ON a.user_id=u.id
       ${whereStr} ORDER BY a.created_at DESC LIMIT $${i} OFFSET $${i+1}`,
      [...params, pageLimit, offset]
    );
    const countRes = await pool.query(`SELECT COUNT(*) FROM audit_log a ${whereStr}`, params);
    listOk(res, result.rows, countRes.rows[0].count, page, pageLimit);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/timeline/:entityType/:entityId', async (req, res) => {
  try {
    const { entityType, entityId } = req.params;
    const result = await pool.query(
      `SELECT a.*, u.name as user_name FROM audit_log a LEFT JOIN users u ON a.user_id=u.id
       WHERE a.record_type=$1 AND a.record_id=$2 ORDER BY a.created_at DESC`,
      [entityType, entityId]
    );
    res.json({ data: result.rows });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
