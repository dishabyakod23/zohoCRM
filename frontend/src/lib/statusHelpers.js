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
