export function ownerName(record) {
  if (!record?.owner) return null;
  return `${record.owner.first_name || ''} ${record.owner.last_name || ''}`.trim() || record.owner.email;
}

export function parseLookupOptions(data, labelFn) {
  if (!Array.isArray(data) || data.length === 0) return [];
  return data.map((item) => {
    if (typeof item === 'string') return { value: item, label: labelFn ? labelFn(item) : item };
    const value = item.value ?? item.key ?? item.code ?? item.id;
    const label = item.label ?? item.name ?? item.display_name ?? item.title ?? (labelFn ? labelFn(value) : value);
    return { value, label };
  }).filter((item) => item.value);
}

export function recordDetailHref(entityType, recordId) {
  if (!entityType || recordId == null) return null;
  const routes = {
    lead: '/leads',
    contact: '/contacts',
    account: '/accounts',
    deal: '/deals',
    task: '/tasks',
    call: '/calls',
    meeting: '/meetings',
    campaign: '/campaigns',
    document: '/documents',
    visit: '/visits',
    project: '/projects',
  };
  const base = routes[entityType];
  return base ? `${base}/${recordId}` : null;
}

export function relatedRecordFromActivity(record) {
  if (record?.related_type && record?.related_id) {
    const type = record.related_type;
    const label = record.related_name
      || record.account_name
      || record.contact_name
      || `${type.charAt(0).toUpperCase()}${type.slice(1)} #${record.related_id}`;
    return { type, id: record.related_id, label };
  }
  if (record?.contact_id) {
    return {
      type: 'contact',
      id: record.contact_id,
      label: record.contact_name || `Contact #${record.contact_id}`,
    };
  }
  if (record?.account_id) {
    return {
      type: 'account',
      id: record.account_id,
      label: record.account_name || `Account #${record.account_id}`,
    };
  }
  return null;
}
