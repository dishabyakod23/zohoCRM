/** Modules with notes API support on the hosted Sales CRM API */
export const NOTES_API_MODULES = new Set(['leads', 'raw-leads', 'qualified-leads', 'proposals']);

export function notesApiSupported(moduleKey) {
  return NOTES_API_MODULES.has(moduleKey);
}

const LEAD_LABEL = (r) => `${r.first_name || ''} ${r.last_name || ''}`.trim() || r.company || 'Lead';

export const MODULE_NOTE_META = {
  leads: { relatedType: 'lead', moduleLabel: 'Lead', getLabel: LEAD_LABEL },
  'raw-leads': { relatedType: 'lead', moduleLabel: 'Lead', getLabel: LEAD_LABEL },
  'qualified-leads': { relatedType: 'lead', moduleLabel: 'Lead', getLabel: LEAD_LABEL },
  proposals: { relatedType: 'lead', moduleLabel: 'Lead', getLabel: LEAD_LABEL },
  contacts: { relatedType: 'contact', moduleLabel: 'Contact', getLabel: (r) => `${r.first_name || ''} ${r.last_name || ''}`.trim() || 'Contact' },
  accounts: { relatedType: 'account', moduleLabel: 'Account', getLabel: (r) => r.name || r.account_name || 'Account' },
  deals: { relatedType: 'deal', moduleLabel: 'Deal', getLabel: (r) => r.deal_name || r.name || 'Deal' },
  tasks: { relatedType: 'task', moduleLabel: 'Task', getLabel: (r) => r.title || r.subject || 'Task' },
  calls: { relatedType: 'call', moduleLabel: 'Call', getLabel: (r) => r.subject || 'Call' },
  meetings: { relatedType: 'meeting', moduleLabel: 'Meeting', getLabel: (r) => r.title || 'Meeting' },
  campaigns: { relatedType: 'campaign', moduleLabel: 'Campaign', getLabel: (r) => r.name || r.campaign_name || 'Campaign' },
  documents: { relatedType: 'document', moduleLabel: 'Document', getLabel: (r) => r.name || r.document_name || 'Document' },
  visits: { relatedType: 'visit', moduleLabel: 'Visit', getLabel: (r) => r.title || r.visit_name || 'Visit' },
  projects: { relatedType: 'project', moduleLabel: 'Project', getLabel: (r) => r.name || r.project_name || 'Project' },
};

export function getNoteMeta(moduleKey) {
  return MODULE_NOTE_META[moduleKey] || MODULE_NOTE_META.leads;
}

export function formatNoteTime(dateStr) {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins} min. ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hr${hrs === 1 ? '' : 's'}. ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days} day${days === 1 ? '' : 's'}. ago`;
  return new Date(dateStr).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
