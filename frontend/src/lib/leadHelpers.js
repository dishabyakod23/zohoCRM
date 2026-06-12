/** Map API snake_case lead_status to display label */
const STATUS_LABELS = {
  none: 'None',
  attempted_to_contact: 'Attempted to Contact',
  contact_in_future: 'Contact in Future',
  contacted: 'Contacted',
  junk_lead: 'Junk Lead',
  lost_lead: 'Lost Lead',
  not_contacted: 'Not Contacted',
  pre_qualified: 'Pre-Qualified',
  not_qualified: 'Not Qualified',
};

const STATUS_TO_API = Object.fromEntries(
  Object.entries(STATUS_LABELS).map(([k, v]) => [v, k])
);

export function leadStatusLabel(status) {
  if (!status) return '—';
  return STATUS_LABELS[status] || status.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

export function leadStatusToApi(label) {
  if (!label) return 'not_contacted';
  return STATUS_TO_API[label] || label.toLowerCase().replace(/ /g, '_');
}

/** Normalize API lead for UI (keeps backward-compatible field names) */
export function normalizeLead(lead) {
  if (!lead) return lead;
  const ownerName = lead.owner
    ? `${lead.owner.first_name || ''} ${lead.owner.last_name || ''}`.trim()
    : null;
  return {
    ...lead,
    status: leadStatusLabel(lead.lead_status),
    lead_status: lead.lead_status,
    source: lead.lead_source,
    lead_source: lead.lead_source,
    owner_name: ownerName,
    converted: lead.is_converted,
    employees: lead.no_of_employees,
    zip: lead.zip_code,
  };
}

/** Build LeadCreate / LeadUpdate payload for API */
export function toLeadPayload(form, { partial = false } = {}) {
  const payload = {
    first_name: form.first_name || null,
    last_name: form.last_name,
    company: form.company,
    email: form.email,
    phone: form.phone,
    mobile: form.mobile || null,
    title: form.title || null,
    lead_source: form.source || form.lead_source || null,
    industry: form.industry || null,
    lead_status: leadStatusToApi(form.status || form.lead_status || 'Not Contacted'),
    description: form.description || null,
    website: form.website || null,
    street: form.street || null,
    city: form.city || null,
    state: form.state || null,
    country: form.country || null,
    zip_code: form.zip || form.zip_code || null,
    no_of_employees: form.employees || form.no_of_employees || null,
    rating: form.rating || null,
    owner_id: form.owner_id || null,
  };

  if (partial) {
    return Object.fromEntries(Object.entries(payload).filter(([, v]) => v !== undefined && v !== null && v !== ''));
  }
  return payload;
}

export { STATUS_LABELS };
