const { canDownload, canEdit, isAdmin, isManagerOrAdmin, normalizeRole } = require('../utils/helpers');

const requireRole = (...roles) => (req, res, next) => {
  const role = normalizeRole(req.user.role);
  if (!roles.includes(role)) return res.status(403).json({ error: 'Insufficient permissions' });
  next();
};

const requireEdit = (req, res, next) => {
  if (!canEdit(req.user.role)) return res.status(403).json({ error: 'Read-only access' });
  next();
};

const requireDownload = (req, res, next) => {
  if (!canDownload(req.user.role)) return res.status(403).json({ error: 'Download not permitted for your role' });
  next();
};

const requireAdmin = (req, res, next) => {
  if (!isAdmin(req.user.role)) return res.status(403).json({ error: 'Admin access required' });
  next();
};

const requireManagerOrAdmin = (req, res, next) => {
  if (!isManagerOrAdmin(req.user.role)) return res.status(403).json({ error: 'Manager or admin access required' });
  next();
};

module.exports = { requireRole, requireEdit, requireDownload, requireAdmin, requireManagerOrAdmin };
