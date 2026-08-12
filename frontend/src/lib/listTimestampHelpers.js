export function formatRecordDateTime(value) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

export function recordTimestampColumns() {
  return [
    {
      id: 'created_at',
      header: 'Created Date & Time',
      cell: (record) => formatRecordDateTime(record.created_at),
    },
    {
      id: 'updated_at',
      header: 'Updated Date & Time',
      cell: (record) => formatRecordDateTime(record.updated_at),
    },
  ];
}
