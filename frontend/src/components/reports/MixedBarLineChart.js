'use client';
import { useMemo } from 'react';
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

/**
 * Mixed bar + line chart (ECharts dual-axis style) for categorical counts.
 * Bars = absolute count; line = share of total (%).
 */
export default function MixedBarLineChart({
  data = [],
  dataKey = 'count',
  nameKey = 'label',
  barName = 'Leads',
  lineName = 'Share %',
  barColor = '#378ADD',
  lineColor = '#EF9F27',
  height = 280,
}) {
  const rows = useMemo(() => {
    const list = (data || []).map((row) => ({
      ...row,
      name: row[nameKey] ?? row.name ?? row.label ?? '—',
      count: Number(row[dataKey] ?? row.count ?? row.value ?? 0) || 0,
    }));
    const total = list.reduce((sum, row) => sum + row.count, 0) || 1;
    return list.map((row) => ({
      ...row,
      share: Math.round((row.count / total) * 1000) / 10,
    }));
  }, [data, dataKey, nameKey]);

  if (!rows.length) {
    return (
      <p className="text-sm text-zoho-muted py-10 text-center">No source data</p>
    );
  }

  const maxCount = rows.reduce((max, row) => Math.max(max, row.count), 0);
  const countCeiling = Math.max(5, Math.ceil(maxCount / 5) * 5);

  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={rows} margin={{ top: 8, right: 12, left: 0, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
        <XAxis
          dataKey="name"
          tick={{ fontSize: 10 }}
          interval={0}
          angle={rows.length > 6 ? -25 : 0}
          textAnchor={rows.length > 6 ? 'end' : 'middle'}
          height={rows.length > 6 ? 56 : 30}
        />
        <YAxis
          yAxisId="count"
          tick={{ fontSize: 11 }}
          domain={[0, countCeiling]}
          allowDecimals={false}
          label={{ value: barName, angle: -90, position: 'insideLeft', style: { fontSize: 11, fill: '#6B7280' } }}
        />
        <YAxis
          yAxisId="share"
          orientation="right"
          tick={{ fontSize: 11 }}
          domain={[0, 100]}
          tickFormatter={(v) => `${v}%`}
          label={{ value: lineName, angle: 90, position: 'insideRight', style: { fontSize: 11, fill: '#6B7280' } }}
        />
        <Tooltip
          cursor={{ fill: 'rgba(55, 138, 221, 0.08)' }}
          formatter={(value, name) => {
            if (name === lineName) return [`${value}%`, name];
            return [value, name];
          }}
        />
        <Legend />
        <Bar
          yAxisId="count"
          dataKey="count"
          name={barName}
          fill={barColor}
          radius={[4, 4, 0, 0]}
          maxBarSize={42}
        />
        <Line
          yAxisId="share"
          type="monotone"
          dataKey="share"
          name={lineName}
          stroke={lineColor}
          strokeWidth={2.5}
          dot={{ r: 3, fill: lineColor }}
          activeDot={{ r: 5 }}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
