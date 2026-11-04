import { DEFAULT_CURRENCY } from './currencies.js';
import { normalizeRole } from './roles.js';

/**
 * Team target plan used by the "Set Sales Targets" wizard.
 * Amounts in a plan row are whole-plan totals in display units (₹ Lakh for INR,
 * thousands otherwise); each row is saved as one monthly target per month.
 */

export const PLAN_METRICS = [
  { key: 'revenue', label: 'Revenue Target', hint: 'Target to be closed', type: 'amount', apiField: 'revenue_target' },
  { key: 'pipeline', label: 'Pipeline Target', hint: 'Qualified pipeline to be created', type: 'amount', apiField: 'pipeline_target' },
  { key: 'meetings', label: 'Qualified Meetings', hint: 'Target count', type: 'count', apiField: 'qualified_meetings_target' },
  { key: 'proposals', label: 'Proposals Sent', hint: 'Target count', type: 'count', apiField: 'proposal_count_target' },
];

export const PLAN_ROLES = {
  sales_manager: 'BDM',
  sales_rep: 'BDE',
};

export const DEFAULT_TARGET_MODEL = {
  metrics: PLAN_METRICS.map((m) => m.key),
  coverage: 4.4,
  bdm_share: 50,
  meetings_per_month: { sales_manager: 9, sales_rep: 13 },
  proposals_per_month: { sales_manager: 6, sales_rep: 4 },
};

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function parseDate(value) {
  const [y, m, d] = String(value || '').split('-').map(Number);
  if (!y || !m || !d) return null;
  return new Date(Date.UTC(y, m - 1, d));
}

function isoDate(date) {
  return date.toISOString().slice(0, 10);
}

function toNum(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

/** Unit used for amount inputs: ₹ Lakh for INR, thousands for other currencies. */
export function amountUnit(currency = DEFAULT_CURRENCY) {
  if (currency === 'INR') return { multiplier: 100000, label: '₹ Lakh', short: 'L' };
  return { multiplier: 1000, label: `${currency} '000`, short: 'K' };
}

/** BDM for sales managers, BDE for everyone else on the sales team. */
export function planRoleForUser(user) {
  return normalizeRole(user?.role) === 'sales_manager' ? 'sales_manager' : 'sales_rep';
}

/** Calendar months covered by [start, end], each clipped to the range. */
export function monthsInRange(start, end) {
  const from = parseDate(start);
  const to = parseDate(end);
  if (!from || !to || from > to) return [];
  const months = [];
  let cursor = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), 1));
  while (cursor <= to) {
    const monthEnd = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 0));
    const sliceStart = cursor < from ? from : cursor;
    const sliceEnd = monthEnd > to ? to : monthEnd;
    months.push({
      start: isoDate(sliceStart),
      end: isoDate(sliceEnd),
      label: `${MONTH_NAMES[cursor.getUTCMonth()]} ${cursor.getUTCFullYear()}`,
    });
    cursor = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 1));
  }
  return months;
}

export function weeksInRange(start, end) {
  const from = parseDate(start);
  const to = parseDate(end);
  if (!from || !to || from > to) return 0;
  return ((to - from) / 86400000 + 1) / 7;
}

/** "Oct 2026 – Jun 2027 (9 Months)" */
export function periodSummary(start, end) {
  const months = monthsInRange(start, end);
  if (!months.length) return '—';
  const first = months[0].label;
  const last = months[months.length - 1].label;
  const count = `${months.length} Month${months.length === 1 ? '' : 's'}`;
  return first === last ? `${first} (${count})` : `${first} – ${last} (${count})`;
}

/**
 * Split a total into n parts that add back up exactly.
 * Counts are whole numbers (remainder goes to the earliest parts); amounts keep 2 decimals.
 */
export function splitEvenly(total, n, { integer = false } = {}) {
  if (n <= 0) return [];
  if (integer) {
    const whole = Math.max(0, Math.round(toNum(total)));
    const base = Math.floor(whole / n);
    const extra = whole - base * n;
    return Array.from({ length: n }, (_, i) => base + (i < extra ? 1 : 0));
  }
  const cents = Math.round(toNum(total) * 100);
  const base = Math.floor(cents / n);
  const extra = cents - base * n;
  return Array.from({ length: n }, (_, i) => (base + (i < extra ? 1 : 0)) / 100);
}

export function emptyPlanRow(user) {
  return {
    employee_id: user.id,
    name: user.name,
    role: planRoleForUser(user),
    revenue: '',
    pipeline: '',
    meetings: '',
    proposals: '',
  };
}

/**
 * Fill every row from the team revenue target and the target model:
 * revenue split between BDMs and BDEs by bdm_share (equal within a role),
 * pipeline = revenue × coverage, meetings/proposals = per-month rate × months.
 * `teamRevenue` is in display units.
 */
export function autoDistribute(rows, { teamRevenue, model = DEFAULT_TARGET_MODEL, months }) {
  const bdms = rows.filter((r) => r.role === 'sales_manager').length;
  const bdes = rows.length - bdms;
  const total = toNum(teamRevenue);
  let bdmPool = total * (toNum(model.bdm_share) / 100);
  let bdePool = total - bdmPool;
  // With only one role on the team, that role takes the whole target.
  if (!bdms) { bdePool = total; bdmPool = 0; }
  if (!bdes) { bdmPool = total; bdePool = 0; }
  const bdmShares = splitEvenly(bdmPool, bdms);
  const bdeShares = splitEvenly(bdePool, bdes);
  let bdmIndex = 0;
  let bdeIndex = 0;
  return rows.map((row) => {
    const isBdm = row.role === 'sales_manager';
    const revenue = isBdm ? bdmShares[bdmIndex++] : bdeShares[bdeIndex++];
    return {
      ...row,
      revenue: revenue ?? 0,
      pipeline: Math.round(revenue * toNum(model.coverage) * 100) / 100,
      meetings: Math.round(toNum(model.meetings_per_month?.[row.role]) * months),
      proposals: Math.round(toNum(model.proposals_per_month?.[row.role]) * months),
    };
  });
}

/** Team totals plus the revenue split by role (display units). */
export function summarizePlan(rows) {
  const sum = (key, list = rows) => list.reduce((acc, r) => acc + toNum(r[key]), 0);
  const bdms = rows.filter((r) => r.role === 'sales_manager');
  const bdes = rows.filter((r) => r.role !== 'sales_manager');
  return {
    revenue: sum('revenue'),
    pipeline: sum('pipeline'),
    meetings: sum('meetings'),
    proposals: sum('proposals'),
    bdmCount: bdms.length,
    bdeCount: bdes.length,
    bdmRevenue: sum('revenue', bdms),
    bdeRevenue: sum('revenue', bdes),
  };
}

/** Average plan row for a role, divided per week (display units). */
export function weeklyPerPerson(rows, role, weeks) {
  const list = rows.filter((r) => r.role === role);
  if (!list.length || weeks <= 0) return null;
  const avg = (key) => list.reduce((acc, r) => acc + toNum(r[key]), 0) / list.length / weeks;
  return {
    revenue: avg('revenue'),
    pipeline: avg('pipeline'),
    meetings: avg('meetings'),
    proposals: avg('proposals'),
  };
}

/** Per-period breakdown of one row: months grouped into chunks of `size` (3 = quarters). */
export function breakdownRow(row, months, size = 1) {
  const n = months.length;
  const parts = {
    revenue: splitEvenly(row.revenue, n),
    pipeline: splitEvenly(row.pipeline, n),
    meetings: splitEvenly(row.meetings, n, { integer: true }),
    proposals: splitEvenly(row.proposals, n, { integer: true }),
  };
  const groups = [];
  for (let i = 0; i < n; i += size) {
    const slice = months.slice(i, i + size);
    const pick = (key) => parts[key].slice(i, i + size).reduce((a, b) => a + b, 0);
    groups.push({
      label: size === 1 ? slice[0].label : `${slice[0].label.slice(0, 3)}–${slice[slice.length - 1].label}`,
      revenue: Math.round(pick('revenue') * 100) / 100,
      pipeline: Math.round(pick('pipeline') * 100) / 100,
      meetings: pick('meetings'),
      proposals: pick('proposals'),
    });
  }
  return groups;
}

/**
 * One sales-target form per member per month, ready for toSalesTargetPayload.
 * Display-unit amounts are converted back to currency; disabled metrics are left unset.
 */
export function buildMonthlyTargetForms(rows, { start, end, currency, status, metrics = DEFAULT_TARGET_MODEL.metrics }) {
  const months = monthsInRange(start, end);
  const { multiplier } = amountUnit(currency);
  const enabled = new Set(metrics);
  const forms = [];
  for (const row of rows) {
    const parts = {
      revenue: splitEvenly(toNum(row.revenue) * multiplier, months.length),
      pipeline: splitEvenly(toNum(row.pipeline) * multiplier, months.length),
      meetings: splitEvenly(row.meetings, months.length, { integer: true }),
      proposals: splitEvenly(row.proposals, months.length, { integer: true }),
    };
    months.forEach((month, i) => {
      const form = {
        period_type: 'monthly',
        period_name: month.label,
        start_date: month.start,
        end_date: month.end,
        employee_id: row.employee_id,
        role: row.role,
        currency,
        status,
      };
      for (const metric of PLAN_METRICS) {
        form[metric.apiField] = enabled.has(metric.key) ? parts[metric.key][i] : '';
      }
      forms.push(form);
    });
  }
  return forms;
}

const CSV_COLUMNS = ['Team Member', 'Role', 'Revenue', 'Pipeline', 'Qualified Meetings', 'Proposals Sent'];

function csvCell(value) {
  const text = String(value ?? '');
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function planToCsv(rows) {
  const lines = [CSV_COLUMNS.join(',')];
  for (const row of rows) {
    lines.push([row.name, PLAN_ROLES[row.role], row.revenue, row.pipeline, row.meetings, row.proposals].map(csvCell).join(','));
  }
  return lines.join('\n');
}

function parseCsvLine(line) {
  const cells = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') { cell += '"'; i += 1; } else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') { cells.push(cell); cell = ''; } else cell += ch;
  }
  cells.push(cell);
  return cells.map((c) => c.trim());
}

/**
 * Apply an exported/edited CSV back onto the plan, matching members by name (case-insensitive).
 * Returns the updated rows and the names that matched nobody.
 */
export function applyCsvToPlan(rows, text) {
  const lines = String(text || '').split(/\r?\n/).filter((l) => l.trim());
  const byName = new Map(rows.map((r) => [String(r.name).trim().toLowerCase(), r]));
  const updates = new Map();
  const unmatched = [];
  for (const line of lines.slice(1)) {
    const [name, , revenue, pipeline, meetings, proposals] = parseCsvLine(line);
    const row = byName.get(String(name).toLowerCase());
    if (!row) { if (name) unmatched.push(name); continue; }
    updates.set(row.employee_id, {
      revenue: toNum(revenue), pipeline: toNum(pipeline), meetings: toNum(meetings), proposals: toNum(proposals),
    });
  }
  return {
    rows: rows.map((r) => (updates.has(r.employee_id) ? { ...r, ...updates.get(r.employee_id) } : r)),
    unmatched,
  };
}
