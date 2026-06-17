const { randomUUID } = require('crypto');
const pool = require('../db/pool');

const SETTINGS_KEY = 'custom_lead_statuses';
const LEAD_STATUS_CATEGORY = 'lead-statuses';

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

function systemOption(status, index) {
  const now = new Date().toISOString();
  return {
    id: `system-${status.value}`,
    category: LEAD_STATUS_CATEGORY,
    value: status.value,
    label: status.label,
    sort_order: index,
    is_active: true,
    is_system: true,
    metadata: null,
    created_at: now,
    updated_at: now,
  };
}

function customOption(entry, index) {
  const now = new Date().toISOString();
  return {
    id: entry.id || entry.value,
    category: LEAD_STATUS_CATEGORY,
    value: entry.value,
    label: entry.label,
    sort_order: entry.sort_order ?? index + SYSTEM_LEAD_STATUSES.length,
    is_active: entry.is_active ?? true,
    is_system: false,
    metadata: entry.metadata ?? null,
    created_at: entry.created_at || now,
    updated_at: entry.updated_at || now,
  };
}

async function getCustomLeadStatuses() {
  try {
    const result = await pool.query(`SELECT value FROM settings WHERE key=$1`, [SETTINGS_KEY]);
    const raw = result.rows[0]?.value;
    if (!Array.isArray(raw)) return [];
    return raw
      .filter((item) => item?.value && item?.label)
      .map((item) => ({
        id: item.id || item.value,
        value: item.value,
        label: item.label,
        sort_order: item.sort_order,
        is_active: item.is_active,
        metadata: item.metadata,
        created_at: item.created_at,
        updated_at: item.updated_at,
        is_system: false,
      }));
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
  return [
    ...SYSTEM_LEAD_STATUSES,
    ...custom.filter((s) => !systemValues.has(s.value)),
  ];
}

async function getLeadStatusLookupCategory() {
  const custom = await getCustomLeadStatuses();
  const options = [
    ...SYSTEM_LEAD_STATUSES.map(systemOption),
    ...custom.map(customOption),
  ];
  return {
    category: LEAD_STATUS_CATEGORY,
    label: 'Lead Statuses',
    options,
  };
}

async function addCustomLeadStatus({ label, value, sort_order, is_active = true }) {
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
  const now = new Date().toISOString();
  const entry = {
    id: randomUUID(),
    value: slug,
    label: trimmedLabel,
    sort_order: sort_order ?? custom.length + SYSTEM_LEAD_STATUSES.length,
    is_active: is_active !== false,
    metadata: null,
    created_at: now,
    updated_at: now,
  };
  custom.push(entry);
  await saveCustomLeadStatuses(custom);
  return customOption(entry, entry.sort_order);
}

async function updateCustomLeadStatus(optionId, payload = {}) {
  const custom = await getCustomLeadStatuses();
  const idx = custom.findIndex((s) => s.id === optionId || s.value === optionId);
  if (idx < 0) {
    const err = new Error('Custom status not found');
    err.status = 404;
    throw err;
  }
  const current = custom[idx];
  const updated = {
    ...current,
    label: payload.label ?? current.label,
    sort_order: payload.sort_order ?? current.sort_order,
    is_active: payload.is_active ?? current.is_active,
    metadata: payload.metadata ?? current.metadata,
    updated_at: new Date().toISOString(),
  };
  custom[idx] = updated;
  await saveCustomLeadStatuses(custom);
  return customOption(updated, updated.sort_order);
}

async function deleteCustomLeadStatus(optionId) {
  const custom = await getCustomLeadStatuses();
  const target = custom.find((s) => s.id === optionId || s.value === optionId);
  if (!target) {
    const err = new Error('Custom status not found');
    err.status = 404;
    throw err;
  }
  const system = SYSTEM_LEAD_STATUSES.find((s) => s.value === target.value || s.value === optionId);
  if (system) {
    const err = new Error('System statuses cannot be deleted');
    err.status = 400;
    throw err;
  }
  const next = custom.filter((s) => s.id !== target.id && s.value !== target.value);
  await saveCustomLeadStatuses(next);
  return { message: 'Status removed' };
}

module.exports = {
  LEAD_STATUS_CATEGORY,
  SYSTEM_LEAD_STATUSES,
  slugifyStatus,
  getAllLeadStatuses,
  getLeadStatusLookupCategory,
  addCustomLeadStatus,
  updateCustomLeadStatus,
  deleteCustomLeadStatus,
};
