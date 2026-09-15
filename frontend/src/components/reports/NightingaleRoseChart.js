'use client';
import { useEffect, useMemo, useRef } from 'react';
import * as echarts from 'echarts/core';
import { PieChart } from 'echarts/charts';
import {
  TitleComponent,
  TooltipComponent,
  LegendComponent,
  ToolboxComponent,
} from 'echarts/components';
import { LabelLayout } from 'echarts/features';
import { CanvasRenderer } from 'echarts/renderers';

echarts.use([
  PieChart,
  TitleComponent,
  TooltipComponent,
  LegendComponent,
  ToolboxComponent,
  LabelLayout,
  CanvasRenderer,
]);

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
 * Nightingale rose chart via Apache ECharts (roseType radius + area),
 * matching https://echarts.apache.org/examples/en/editor.html?c=pie-roseType
 */
export default function NightingaleRoseChart({
  data = [],
  dataKey = 'count',
  nameKey = 'label',
  colors = DEFAULT_COLORS,
  height = 360,
  nameFormatter,
}) {
  const hostRef = useRef(null);
  const chartRef = useRef(null);

  const rows = useMemo(() => (
    (data || [])
      .map((row) => {
        const rawName = row[nameKey] ?? row.name ?? row.label ?? '—';
        const name = typeof nameFormatter === 'function'
          ? nameFormatter(rawName)
          : rawName;
        return {
          name: String(name || '—'),
          value: Number(row[dataKey] ?? row.value ?? 0) || 0,
        };
      })
      .filter((row) => row.value > 0)
  ), [data, dataKey, nameKey, nameFormatter]);

  const legendNames = useMemo(() => rows.map((row) => row.name), [rows]);

  useEffect(() => {
    const el = hostRef.current;
    if (!el) return undefined;

    if (!chartRef.current) {
      chartRef.current = echarts.init(el, undefined, { renderer: 'canvas' });
    }
    const chart = chartRef.current;

    if (!rows.length) {
      chart.clear();
      return undefined;
    }

    chart.setOption({
      color: colors,
      tooltip: {
        trigger: 'item',
        formatter: '{a}<br/>{b} : {c} ({d}%)',
      },
      legend: {
        left: 'center',
        top: 'bottom',
        data: legendNames,
        type: legendNames.length > 8 ? 'scroll' : 'plain',
      },
      toolbox: {
        show: true,
        feature: {
          dataView: { show: true, readOnly: true },
          restore: { show: true },
          saveAsImage: { show: true },
        },
      },
      series: [
        {
          name: 'Radius Mode',
          type: 'pie',
          radius: [20, 110],
          center: ['25%', '48%'],
          roseType: 'radius',
          itemStyle: {
            borderRadius: 5,
          },
          label: {
            show: false,
          },
          emphasis: {
            label: {
              show: true,
            },
          },
          data: rows,
        },
        {
          name: 'Area Mode',
          type: 'pie',
          radius: [20, 110],
          center: ['75%', '48%'],
          roseType: 'area',
          itemStyle: {
            borderRadius: 5,
          },
          data: rows,
        },
      ],
    }, true);

    const onResize = () => chart.resize();
    window.addEventListener('resize', onResize);
    const ro = typeof ResizeObserver !== 'undefined'
      ? new ResizeObserver(onResize)
      : null;
    ro?.observe(el);

    return () => {
      window.removeEventListener('resize', onResize);
      ro?.disconnect();
    };
  }, [rows, legendNames, colors]);

  useEffect(() => () => {
    chartRef.current?.dispose();
    chartRef.current = null;
  }, []);

  if (!rows.length) {
    return (
      <p className="text-sm text-zoho-muted py-10 text-center">No status data</p>
    );
  }

  return (
    <div
      ref={hostRef}
      className="w-full"
      style={{ height, minHeight: height }}
    />
  );
}
