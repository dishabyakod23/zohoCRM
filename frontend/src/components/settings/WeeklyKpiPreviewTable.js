'use client';

function statusClass(status) {
  if (status === 'On Track') return 'text-emerald-700 font-semibold';
  if (status === 'Needs Attention') return 'text-amber-700 font-semibold';
  if (status === 'Off Track') return 'text-red-700 font-semibold';
  return 'text-gray-500';
}

export default function WeeklyKpiPreviewTable({
  title = 'Weekly KPI Summary',
  rows = [],
  ownerName = '',
  periodStart = '',
  periodEnd = '',
  footer = 'Company CRM · Individual weekly performance report',
}) {
  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden bg-white">
      <div className="bg-slate-800 text-white px-4 py-3">
        <p className="text-[11px] uppercase tracking-wide text-red-200">Weekly Business Development &amp; Sales Status Report</p>
        <h3 className="text-base font-semibold mt-1">{ownerName || 'Employee Name'}</h3>
        {(periodStart || periodEnd) && (
          <p className="text-xs text-slate-300 mt-1">{periodStart} – {periodEnd}</p>
        )}
      </div>
      <div className="p-4">
        <h4 className="text-sm font-semibold text-red-700 mb-3">{title}</h4>
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100">
                <th className="table-th border">Metric</th>
                <th className="table-th border text-right">Weekly Target</th>
                <th className="table-th border text-right">Actual</th>
                <th className="table-th border text-right">Achievement %</th>
                <th className="table-th border">Status</th>
                <th className="table-th border">Owner</th>
                <th className="table-th border">Remarks</th>
                <th className="table-th border">Management Notes</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="table-td border text-center py-6 text-gray-400">
                    Add metrics above to preview the report
                  </td>
                </tr>
              ) : rows.map((row) => (
                <tr key={row.id || row.key || row.label}>
                  <td className="table-td border font-medium">{row.label}</td>
                  <td className="table-td border text-right">{row.displayTarget}</td>
                  <td className="table-td border text-right font-semibold">{row.displayActual}</td>
                  <td className="table-td border text-right">{row.achievementPct}</td>
                  <td className={`table-td border ${statusClass(row.status)}`}>{row.status}</td>
                  <td className="table-td border">{ownerName || '—'}</td>
                  <td className="table-td border" />
                  <td className="table-td border" />
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div className="px-4 py-2 bg-slate-50 border-t text-[11px] text-slate-500">{footer}</div>
    </div>
  );
}
