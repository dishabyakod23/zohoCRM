/** Status values that require a lost reason (detail save + mass update) */
export const LOST_LEAD_STATUS_VALUES = new Set([
  'lost',
  'deal_lost',
  'lost_lead',
  'not_qualified',
  'junk_lead',
]);

export function isLostLeadStatus(value) {
  return LOST_LEAD_STATUS_VALUES.has(String(value || '').toLowerCase().trim());
}

/** Hosted API LostReason enum (GET /lookups/lost-reasons may be empty/unavailable). */
export const FALLBACK_LOST_REASONS = [
  { value: 'budget_issue', label: 'Budget Issue' },
  { value: 'no_requirement', label: 'No Requirement' },
  { value: 'competitor_selected', label: 'Competitor Selected' },
  { value: 'timeline_delayed', label: 'Timeline Delayed' },
  { value: 'not_decision_maker', label: 'Not Decision Maker' },
  { value: 'no_response', label: 'No Response' },
  { value: 'price_high', label: 'Price High' },
  { value: 'requirement_not_fit', label: 'Requirement Not Fit' },
];

/** Normalize API / form lost_reason into a plain string code. */
export function normalizeLostReasonValue(raw) {
  if (raw == null || raw === '') return '';
  if (typeof raw === 'object') {
    return String(raw.value ?? raw.key ?? raw.code ?? raw.id ?? '').trim();
  }
  return String(raw).trim();
}

/** Display label for a lost reason code. */
export function lostReasonLabel(value, options = []) {
  const code = normalizeLostReasonValue(value);
  if (!code) return null;
  const list = Array.isArray(options) && options.length ? options : FALLBACK_LOST_REASONS;
  const match = list.find((o) => String(o.value).toLowerCase() === code.toLowerCase());
  if (match?.label) return match.label;
  return code.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export function isLeadStatusMassField(field, fieldDef) {
  const value = String(field || '').toLowerCase();
  const defValue = String(fieldDef?.value || '').toLowerCase();
  const defLabel = String(fieldDef?.label || '').toLowerCase();
  return value === 'lead_status' || value === 'status'
    || defValue === 'lead_status' || defValue === 'status'
    || defLabel === 'lead status';
}

/** Convert display label to API snake_case status value */
export function slugifyStatusValue(label) {
  return String(label || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

/** Admin lookup-options category for lead statuses (matches GET /lookups/lead-statuses) */
export const LEAD_STATUS_CATEGORY = 'lead-statuses';

/** Fallback category slugs seen across API versions */
export const LEAD_STATUS_CATEGORY_CANDIDATES = [
  'lead-statuses',
  'lead_status',
  'lead_statuses',
];

/** Hosted API LeadStatus enum — custom values must be accepted by the server */
export const HOSTED_LEAD_STATUS_VALUES = [
  'raw_prospect',
  'contacted',
  'qualified_lead',
  'deal_lost',
];

/** Build POST body for lookup-options — omit null/empty fields */
export function buildLookupOptionPayload({ label, value, sort_order, is_active = true }) {
  const payload = { label: String(label || '').trim(), is_active };
  const resolvedValue = (value || '').trim() || slugifyStatusValue(label);
  if (resolvedValue) payload.value = resolvedValue;
  if (Number.isInteger(sort_order)) payload.sort_order = sort_order;
  return payload;
}

/** Normalize LookupOptionOut → UI row */
export function normalizeLookupOption(option) {
  if (!option) return option;
  return {
    id: option.id,
    value: option.value,
    label: option.label,
    is_system: option.is_system ?? false,
    is_active: option.is_active ?? true,
    sort_order: option.sort_order ?? 0,
    category: option.category,
  };
}
