const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const pool = require('../db/pool');
const auth = require('../middleware/auth');
const { requireEdit } = require('../middleware/roles');
const { softDelete } = require('../utils/helpers');

const router = express.Router();
router.use(auth);

const uploadDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: uploadDir,
  filename: (_, file, cb) => cb(null, `${Date.now()}-${file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_')}`),
});
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_, file, cb) => {
    const allowed = /\.(pdf|docx|xlsx|jpg|jpeg|png)$/i;
    cb(null, allowed.test(file.originalname));
  },
});

router.get('/', async (req, res) => {
  try {
    const { search, related_type, related_id, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;
    let where = ['d.deleted_at IS NULL'];
    const params = [];
    let i = 1;
    if (search) { where.push(`d.name ILIKE $${i}`); params.push(`%${search}%`); i++; }
    if (related_type) { where.push(`d.related_type=$${i}`); params.push(related_type); i++; }
    if (related_id) { where.push(`d.related_id=$${i}`); params.push(related_id); i++; }
    const whereStr = 'WHERE ' + where.join(' AND ');
    const result = await pool.query(
      `SELECT d.*, u.name as owner_name FROM documents d LEFT JOIN users u ON d.owner_id=u.id
       ${whereStr} ORDER BY d.created_at DESC LIMIT $${i} OFFSET $${i + 1}`,
      [...params, limit, offset]
    );
    const countRes = await pool.query(`SELECT COUNT(*) FROM documents d ${whereStr}`, params);
    res.json({ data: result.rows, total: parseInt(countRes.rows[0].count), page: +page, limit: +limit });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/', requireEdit, upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'File required' });
  const { name, description, folder, related_type, related_id } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO documents (name, description, file_path, file_type, file_size, folder, owner_id, related_type, related_id, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [name || req.file.originalname, description, req.file.filename, req.file.mimetype, req.file.size,
       folder, req.user.id, related_type, related_id, req.user.id]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/:id/download', async (req, res) => {
  try {
    const result = await pool.query(`SELECT * FROM documents WHERE id=$1 AND deleted_at IS NULL`, [req.params.id]);
    if (!result.rows[0]) return res.status(404).json({ error: 'Document not found' });
    const filePath = path.join(uploadDir, result.rows[0].file_path);
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File not found on disk' });
    res.download(filePath, result.rows[0].name);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/:id', requireEdit, async (req, res) => {
  try {
    await softDelete('documents', req.params.id, req.user.id);
    res.json({ message: 'Document moved to recycle bin' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
