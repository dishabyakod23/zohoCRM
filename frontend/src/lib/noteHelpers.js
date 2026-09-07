/** CRM modules that support record notes via GET/POST /notes */
export const NOTES_API_MODULES = new Set([
  'leads',
  'raw-leads',
  'qualified-leads',
  'proposals',
  'contacts',
  'accounts',
  'deals',
  'tasks',
  'calls',
  'meetings',
  'campaigns',
  'documents',
  'visits',
  'projects',
]);

/** entity_type values accepted by GET/POST /api/v1/notes */
export const NOTES_ENTITY_TYPES = new Set([
  'lead',
  'contact',
  'account',
  'deal',
  'task',
  'call',
  'meeting',
  'campaign',
  'document',
  'visit',
  'project',
]);

export function notesApiSupported(moduleKey) {
  return NOTES_API_MODULES.has(moduleKey);
}

export function notesSupportedRelatedType(relatedType) {
  return NOTES_ENTITY_TYPES.has(relatedType);
}

const LEAD_LABEL = (r) => `${r.first_name || ''} ${r.last_name || ''}`.trim() || r.company || 'Lead';

export const MODULE_NOTE_META = {
  leads: { relatedType: 'lead', moduleLabel: 'Warm Lead', getLabel: LEAD_LABEL },
  'raw-leads': { relatedType: 'lead', moduleLabel: 'Cold Lead', getLabel: LEAD_LABEL },
  'qualified-leads': { relatedType: 'lead', moduleLabel: 'Qualified Lead', getLabel: LEAD_LABEL },
  proposals: { relatedType: 'lead', moduleLabel: 'Proposal', getLabel: LEAD_LABEL },
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

const LEAD_NOTE_ENTITIES = new Set(['lead', 'raw_lead', 'qualified_lead', 'proposal']);
const LEAD_NOTE_MODULES = new Set(['leads', 'raw-leads', 'qualified-leads', 'proposals']);

/**
 * Resolve notes API entity_type + bare record id for a list row.
 * Contacts directory rows often use composite ids like `contact:<uuid>`.
 */
export function resolveListNoteTarget({
  moduleKey,
  record,
  rowId,
  noteMeta,
  parseRowId,
  getRecordId,
} = {}) {
  const meta = noteMeta || getNoteMeta(moduleKey);
  const parsed = typeof parseRowId === 'function'
    ? parseRowId(rowId)
    : { entityType: '', recordId: rowId };
  const explicitEntity = String(
    record?.entity_type || record?._entityType || record?.record_type || '',
  ).toLowerCase();
  const prefixedEntity = String(rowId || '').includes(':')
    ? String(parsed?.entityType || '').toLowerCase()
    : '';
  const entity = explicitEntity || prefixedEntity;

  let relatedType = meta.relatedType;
  if (LEAD_NOTE_MODULES.has(moduleKey)) {
    relatedType = 'lead';
  } else if (entity.includes('lead') || LEAD_NOTE_ENTITIES.has(entity)) {
    relatedType = 'lead';
  } else if (entity === 'deal') {
    relatedType = 'deal';
  } else if (entity === 'account') {
    relatedType = 'account';
  } else if (entity === 'contact') {
    relatedType = 'contact';
  }

  const recordId = parsed?.recordId
    || (typeof getRecordId === 'function' ? getRecordId(record) : null)
    || record?.record_id
    || record?.entity_id
    || rowId;

  return { relatedType, recordId: recordId ? String(recordId) : '' };
}

function asUserId(value) {
  if (value == null || value === '') return '';
  if (typeof value === 'object') return value.id || value.user_id || '';
  return value;
}

export function noteOwnerId(note) {
  return asUserId(note?.owner_id)
    || asUserId(note?.created_by)
    || asUserId(note?.created_by_id)
    || asUserId(note?.user_id)
    || asUserId(note?.author_id)
    || '';
}

/** Edit/delete notes only when the current user owns them (admins can always manage). */
export function canManageNote(note, user, { canEdit = false, isAdmin = false } = {}) {
  if (!canEdit) return false;
  if (isAdmin) return true;
  const ownerId = noteOwnerId(note);
  if (!ownerId) return false;
  return Boolean(user?.id) && String(ownerId) === String(user.id);
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
