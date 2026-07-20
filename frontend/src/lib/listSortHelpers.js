export const DEFAULT_LIST_SORT = 'created_desc';

export const LIST_SORT_OPTIONS = [
  { value: 'name_asc', label: 'Name (A → Z)' },
  { value: 'created_desc', label: 'Recently Created' },
  { value: 'created_asc', label: 'Oldest Created' },
];

export const MODULE_SORT_CONFIG = {
  accounts: { apiNameField: 'name', getLabel: (r) => r.name },
  contacts: { apiNameField: 'first_name', compareFirstName: true },
  leads: { apiNameField: 'first_name', compareFirstName: true },
  'raw-leads': { apiNameField: 'first_name', compareFirstName: true },
  'qualified-leads': { apiNameField: 'first_name', compareFirstName: true },
  proposals: { apiNameField: 'first_name', compareFirstName: true },
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

function compareNameAsc(a, b, config) {
  if (config.compareFirstName) {
    const byFirst = compareStrings(a?.first_name, b?.first_name);
    if (byFirst !== 0) return byFirst;
    return compareStrings(a?.last_name, b?.last_name);
  }
  return compareStrings(config.getLabel(a), config.getLabel(b));
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
      sorted.sort((a, b) => compareNameAsc(a, b, config));
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
