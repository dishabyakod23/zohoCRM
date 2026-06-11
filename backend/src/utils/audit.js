const pool = require('../db/pool');

async function logAudit({ recordType, recordId, action, fieldName, oldValue, newValue, userId }) {
  await pool.query(
    `INSERT INTO audit_log (record_type, record_id, action, field_name, old_value, new_value, user_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    [recordType, recordId, action, fieldName || null, oldValue || null, newValue || null, userId]
  );
}

async function getAuditTrail(recordType, recordId) {
  const result = await pool.query(
    `SELECT a.*, u.name as user_name FROM audit_log a
     LEFT JOIN users u ON a.user_id = u.id
     WHERE a.record_type = $1 AND a.record_id = $2
     ORDER BY a.created_at DESC`,
    [recordType, recordId]
  );
  return result.rows;
}

module.exports = { logAudit, getAuditTrail };
