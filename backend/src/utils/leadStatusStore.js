const pool = require('../db/pool');

const SETTINGS_KEY = 'custom_lead_statuses';

/** Pipeline + common CRM statuses — cannot be deleted by admin */
const SYSTEM_LEAD_STATUSES = [
  { value: 'raw_prospect', label: 'Raw Prospect', is_system: true },
  { value: 'contacted', label: 'Contacted', is_system: true },
  { value: 'qualified_lead', label: 'Qualified Lead', is_system: true },
  { value: 'deal_lost', label: 'Deal Lost', is_system: true },
  { value: 'not_contacted', label: 'Not Contacted', is_system: true },
  { value: 'attempted_to_contact', label: 'Attempted to Contact', is_system: true },
  { value: 'contact_in_future', label: 'Contact in Future', is_system: true },
  { value: 'pre_qualified', label: 'Pre-Qualified', is_system: true },
  { value: 'not_qualified', label: 'Not Qualified', is_system: true },
  { value: 'junk_lead', label: 'Junk Lead', is_system: true },
  { value: 'lost_lead', label: 'Lost Lead', is_system: true },
  { value: 'none', label: 'None', is_system: true },
];

function slugifyStatus(label) {
  return String(label || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

async function getCustomLeadStatuses() {
  try {
    const result = await pool.query(`SELECT value FROM settings WHERE key=$1`, [SETTINGS_KEY]);
    const raw = result.rows[0]?.value;
    if (!Array.isArray(raw)) return [];
    return raw
      .filter((item) => item?.value && item?.label)
      .map((item) => ({ value: item.value, label: item.label, is_system: false }));
  } catch {
    return [];
  }
}

async function saveCustomLeadStatuses(statuses) {
  await pool.query(
    `INSERT INTO settings (key, value, updated_at) VALUES ($1, $2::jsonb, NOW())
     ON CONFLICT (key) DO UPDATE SET value=$2::jsonb, updated_at=NOW()`,
    [SETTINGS_KEY, JSON.stringify(statuses)],
  );
}

async function getAllLeadStatuses() {
  const custom = await getCustomLeadStatuses();
  const systemValues = new Set(SYSTEM_LEAD_STATUSES.map((s) => s.value));
  const merged = [
    ...SYSTEM_LEAD_STATUSES,
    ...custom.filter((s) => !systemValues.has(s.value)),
  ];
  return merged;
}

async function addCustomLeadStatus({ label, value }) {
  const trimmedLabel = String(label || '').trim();
  if (!trimmedLabel) {
    const err = new Error('Status label is required');
    err.status = 400;
    throw err;
  }
  const slug = slugifyStatus(value || trimmedLabel);
  if (!slug) {
    const err = new Error('Could not generate a valid status value');
    err.status = 400;
    throw err;
  }
  const all = await getAllLeadStatuses();
  if (all.some((s) => s.value === slug)) {
    const err = new Error('A status with this value already exists');
    err.status = 409;
    throw err;
  }
  const custom = await getCustomLeadStatuses();
  const entry = { value: slug, label: trimmedLabel, is_system: false };
  custom.push(entry);
  await saveCustomLeadStatuses(custom.map(({ value, label }) => ({ value, label })));
  return entry;
}

async function deleteCustomLeadStatus(value) {
  const system = SYSTEM_LEAD_STATUSES.find((s) => s.value === value);
  if (system) {
    const err = new Error('System statuses cannot be deleted');
    err.status = 400;
    throw err;
  }
  const custom = await getCustomLeadStatuses();
  const next = custom.filter((s) => s.value !== value);
  if (next.length === custom.length) {
    const err = new Error('Custom status not found');
    err.status = 404;
    throw err;
  }
  await saveCustomLeadStatuses(next.map(({ value, label }) => ({ value, label })));
  return { message: 'Status removed' };
}

module.exports = {
  SYSTEM_LEAD_STATUSES,
  slugifyStatus,
  getAllLeadStatuses,
  addCustomLeadStatus,
  deleteCustomLeadStatus,
};
