export const DEFAULT_LIST_SORT = 'created_desc';

export const LIST_SORT_OPTIONS = [
  { value: 'name_asc', label: 'Name (A → Z)' },
  { value: 'created_desc', label: 'Recently Created' },
  { value: 'created_asc', label: 'Oldest Created' },
];

export const MODULE_SORT_CONFIG = {
  accounts: { apiNameField: 'name', getLabel: (r) => r.name },
  contacts: { apiNameField: 'last_name', getLabel: (r) => `${r.first_name || ''} ${r.last_name || ''}`.trim() },
  leads: { apiNameField: 'last_name', getLabel: (r) => `${r.first_name || ''} ${r.last_name || ''}`.trim() },
  'raw-leads': { apiNameField: 'last_name', getLabel: (r) => `${r.first_name || ''} ${r.last_name || ''}`.trim() },
  'qualified-leads': { apiNameField: 'last_name', getLabel: (r) => `${r.first_name || ''} ${r.last_name || ''}`.trim() },
  proposals: { apiNameField: 'last_name', getLabel: (r) => `${r.first_name || ''} ${r.last_name || ''}`.trim() },
  deals: { apiNameField: 'deal_name', getLabel: (r) => r.name || r.deal_name },
  tasks: { apiNameField: 'subject', getLabel: (r) => r.title || r.subject },
  meetings: { apiNameField: 'title', getLabel: (r) => r.title },
  calls: { apiNameField: 'subject', getLabel: (r) => r.subject },
  campaigns: { apiNameField: 'name', getLabel: (r) => r.name },
  documents: { apiNameField: 'document_name', getLabel: (r) => r.document_name || r.name },
  visits: { apiNameField: 'title', getLabel: (r) => r.title || r.visit_name },
  projects: { apiNameField: 'name', getLabel: (r) => r.name },
  'recycle-bin': { apiNameField: 'entity_name', getLabel: (r) => r.entity_name },
};

function compareStrings(a, b) {
  return String(a || '').localeCompare(String(b || ''), undefined, { sensitivity: 'base' });
}

function getCreatedTime(record) {
  const value = record?.created_at || record?.deleted_at;
  const time = value ? new Date(value).getTime() : 0;
  return Number.isNaN(time) ? 0 : time;
}

export function getSortApiParams(sortKey = DEFAULT_LIST_SORT, moduleKey = 'leads') {
  const config = MODULE_SORT_CONFIG[moduleKey] || MODULE_SORT_CONFIG.leads;
  switch (sortKey) {
    case 'name_asc':
      return { sort_by: config.apiNameField, sort_order: 'asc' };
    case 'created_asc':
      return { sort_by: 'created_at', sort_order: 'asc' };
    case 'created_desc':
    default:
      return { sort_by: 'created_at', sort_order: 'desc' };
  }
}

export function sortRecords(records, sortKey = DEFAULT_LIST_SORT, moduleKey = 'leads') {
  if (!Array.isArray(records) || records.length <= 1) return records || [];
  const config = MODULE_SORT_CONFIG[moduleKey] || MODULE_SORT_CONFIG.leads;
  const sorted = [...records];
  switch (sortKey) {
    case 'name_asc':
      sorted.sort((a, b) => compareStrings(config.getLabel(a), config.getLabel(b)));
      break;
    case 'created_asc':
      sorted.sort((a, b) => getCreatedTime(a) - getCreatedTime(b));
      break;
    case 'created_desc':
    default:
      sorted.sort((a, b) => getCreatedTime(b) - getCreatedTime(a));
      break;
  }
  return sorted;
}
