const COLORS = {
  'New':         'bg-blue-50 text-blue-700 ring-blue-200',
  'Contacted':   'bg-yellow-50 text-yellow-700 ring-yellow-200',
  'Qualified':   'bg-green-50 text-green-700 ring-green-200',
  'Unqualified': 'bg-red-50 text-red-700 ring-red-200',
  'Hot':         'bg-red-50 text-red-700 ring-red-200',
  'Warm':        'bg-orange-50 text-orange-700 ring-orange-200',
  'Cold':        'bg-gray-100 text-gray-600 ring-gray-200',
  'Prospecting': 'bg-blue-50 text-blue-700 ring-blue-200',
  'Qualification':'bg-indigo-50 text-indigo-700 ring-indigo-200',
  'Proposal Sent':'bg-yellow-50 text-yellow-700 ring-yellow-200',
  'Negotiation': 'bg-orange-50 text-orange-700 ring-orange-200',
  'Closed Won':  'bg-emerald-50 text-emerald-700 ring-emerald-200',
  'Closed Lost': 'bg-red-50 text-red-700 ring-red-200',
};

export default function Badge({ label }) {
  const cls = COLORS[label] || 'bg-brand-50 text-brand-700 ring-brand-200';
  return <span className={`badge ${cls}`}>{label}</span>;
}
