'use client';
import { useMemo } from 'react';
import {
  PieChart,
  Pie,
  Cell,
  Sector,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

const DEFAULT_COLORS = [
  '#378ADD',
  '#639922',
  '#EF9F27',
  '#D85A30',
  '#1D9E75',
  '#E24B4A',
  '#7F77DD',
  '#888780',
];

/**
 * Nightingale (rose) pie: equal slice angles, petal length encodes value.
 * Matches the ECharts roseType: 'radius' look without adding echarts.
 */
function RoseSector(props) {
  const {
    cx,
    cy,
    innerRadius,
    outerRadius,
    startAngle,
    endAngle,
    fill,
    payload,
    maxValue,
  } = props;
  const value = Number(payload?.value ?? payload?.count ?? 0);
  const max = Math.max(Number(maxValue) || 1, 1);
  const span = Math.max(Number(outerRadius) - Number(innerRadius), 8);
  const roseOuter = Number(innerRadius) + Math.max(10, (span * value) / max);

  return (
    <Sector
      cx={cx}
      cy={cy}
      innerRadius={innerRadius}
      outerRadius={roseOuter}
      startAngle={startAngle}
      endAngle={endAngle}
      fill={fill}
      cornerRadius={5}
      stroke="#fff"
      strokeWidth={1}
    />
  );
}

export default function NightingaleRoseChart({
  data = [],
  dataKey = 'count',
  nameKey = 'label',
  colors = DEFAULT_COLORS,
  height = 280,
  nameFormatter,
  tooltipFormatter,
}) {
  const rows = useMemo(() => (
    (data || [])
      .map((row) => ({
        ...row,
        name: row[nameKey] ?? row.name ?? row.label ?? '—',
        value: Number(row[dataKey] ?? row.value ?? 0) || 0,
        // Equal angles for nightingale radius mode (value drives petal length only).
        slice: 1,
      }))
      .filter((row) => row.value > 0)
  ), [data, dataKey, nameKey]);

  const maxValue = useMemo(
    () => rows.reduce((max, row) => Math.max(max, row.value), 0),
    [rows],
  );

  if (!rows.length) {
    return (
      <p className="text-sm text-zoho-muted py-10 text-center">No status data</p>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        <Pie
          data={rows}
          dataKey="slice"
          nameKey="name"
          cx="50%"
          cy="46%"
          innerRadius={20}
          outerRadius={120}
          paddingAngle={2}
          label={false}
          labelLine={false}
          shape={(props) => <RoseSector {...props} maxValue={maxValue} />}
        >
          {rows.map((row, i) => (
            <Cell key={`${row.name}-${i}`} fill={colors[i % colors.length]} />
          ))}
        </Pie>
        <Tooltip
          formatter={(value, _name, item) => {
            const count = item?.payload?.value ?? value;
            if (typeof tooltipFormatter === 'function') {
              return tooltipFormatter(count, item?.payload);
            }
            return [count, 'Count'];
          }}
          labelFormatter={(label) => (
            typeof nameFormatter === 'function' ? nameFormatter(label) : label
          )}
        />
        <Legend
          verticalAlign="bottom"
          align="center"
          formatter={(value) => (
            typeof nameFormatter === 'function' ? nameFormatter(value) : value
          )}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}
