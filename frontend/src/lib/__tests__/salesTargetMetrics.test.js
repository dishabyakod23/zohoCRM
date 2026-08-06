import {
  applyMetricsToForm,
  buildPreviewRowsFromReportRow,
  buildSalesTargetSavePayload,
  createMetricRow,
  metricsFromTarget,
  parseRemarksData,
  serializeRemarksData,
} from '../salesTargetMetrics.js';
import { buildSalesTargetReportParams } from '../salesTargetHelpers.js';

const BASE_FORM = {
  period_type: 'weekly',
  period_name: 'Week 1',
  start_date: '2026-08-01',
  end_date: '2026-08-07',
  employee_id: 'emp-1',
  role: 'sales_rep',
  reporting_manager_id: '',
  currency: 'INR',
  pipeline_target: '',
  revenue_target: '',
  collection_target: '',
  proposal_value_target: '',
  proposal_count_target: '',
  qualified_meetings_target: '',
  deal_closure_count_target: '',
  status: 'draft',
  is_manual_override: false,
  override_reason: '',
  remarksText: 'Weekly focus',
};

describe('salesTargetMetrics payload mapping', () => {
  it('maps API-backed metrics to dedicated sales-target fields', () => {
    const metrics = [
      createMetricRow({ key: 'pipeline_value', target: '120000', apiField: 'pipeline_target' }),
      createMetricRow({ key: 'qualified_meetings', target: '8', apiField: 'qualified_meetings_target' }),
    ];
    const payload = buildSalesTargetSavePayload(BASE_FORM, metrics);
    expect(payload.pipeline_target).toBe(120000);
    expect(payload.qualified_meetings_target).toBe(8);
  });

  it('stores built-in KPI metrics without API fields in remarks JSON', () => {
    const metrics = [
      createMetricRow({ key: 'new_leads', label: 'New Leads Added', target: '250' }),
      createMetricRow({ key: 'cold_calls', label: 'Cold Calls Completed', target: '75' }),
    ];
    const payload = buildSalesTargetSavePayload(BASE_FORM, metrics);
    expect(payload.new_leads).toBeUndefined();
    const { text, metrics: stored } = parseRemarksData(payload.remarks);
    expect(text).toBe('Weekly focus');
    expect(stored).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: 'new_leads', target: '250' }),
      expect.objectContaining({ key: 'cold_calls', target: '75' }),
    ]));
  });

  it('clears API fields when their metrics are removed', () => {
    const form = {
      ...BASE_FORM,
      pipeline_target: '99999',
      qualified_meetings_target: '5',
    };
    const payload = buildSalesTargetSavePayload(form, [
      createMetricRow({ key: 'new_leads', target: '10' }),
    ]);
    expect(payload.pipeline_target).toBe(0);
    expect(payload.qualified_meetings_target).toBeNull();
  });

  it('round-trips remarks-backed metrics when loading a target', () => {
    const remarks = serializeRemarksData('Note', [
      { key: 'emails_sent', label: 'Emails Sent', type: 'count', target: '150' },
    ]);
    const parsed = metricsFromTarget({
      remarks,
      pipeline_target: '50000',
      qualified_meetings_target: 3,
    });
    expect(parsed.remarksText).toBe('Note');
    expect(parsed.metrics).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: 'pipeline_value', target: '50000' }),
      expect.objectContaining({ key: 'qualified_meetings', target: 3 }),
      expect.objectContaining({ key: 'emails_sent', target: '150' }),
    ]));
  });

  it('builds KPI preview rows from a performance report row', () => {
    const rows = buildPreviewRowsFromReportRow({
      currency: 'INR',
      pipeline_target: '20000',
      revenue_target: '20000',
      qualified_meetings_target: 5,
      kpi_targets: { new_leads: 20, cold_calls: 12 },
      actuals: {
        actual_pipeline: '0',
        actual_revenue: '0',
        qualified_meetings: 2,
        new_leads: 1,
      },
    });
    expect(rows.some((r) => r.key === 'pipeline_value' && r.displayTarget.includes('20'))).toBe(true);
    expect(rows.some((r) => r.key === 'qualified_meetings' && r.displayActual === '2')).toBe(true);
    expect(rows.some((r) => r.key === 'new_leads' && r.displayTarget === '20')).toBe(true);
    expect(rows.some((r) => r.key === 'cold_calls' && r.displayTarget === '12')).toBe(true);
  });

  it('loads KPI metrics from kpi_targets returned by the API', () => {
    const parsed = metricsFromTarget({
      kpi_targets: { new_leads: 20, cold_calls: 12 },
      qualified_meetings_target: 8,
    });
    expect(parsed.metrics).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: 'new_leads', target: 20 }),
      expect.objectContaining({ key: 'cold_calls', target: 12 }),
      expect.objectContaining({ key: 'qualified_meetings', target: 8 }),
    ]));
  });

  it('strips remarksText from the mapped form', () => {
    const mapped = applyMetricsToForm(BASE_FORM, []);
    expect(mapped.remarksText).toBeUndefined();
    expect(mapped.remarks).toBe('Weekly focus');
  });
});

describe('buildSalesTargetReportParams', () => {
  it('omits date filters when all_time is enabled', () => {
    const params = buildSalesTargetReportParams({
      period_type: 'weekly',
      all_time: true,
      date_from: '2026-01-01',
      date_to: '2026-08-01',
      employee_id: 'emp-1',
    });
    expect(params.period_type).toBe('weekly');
    expect(params.date_from).toBeUndefined();
    expect(params.date_to).toBeUndefined();
    expect(params.employee_id).toBe('emp-1');
  });
});
