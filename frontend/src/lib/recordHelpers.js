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
