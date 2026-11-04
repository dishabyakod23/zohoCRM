import {
  monthsInRange,
  periodSummary,
  splitEvenly,
  autoDistribute,
  summarizePlan,
  weeklyPerPerson,
  breakdownRow,
  buildMonthlyTargetForms,
  planToCsv,
  applyCsvToPlan,
  DEFAULT_TARGET_MODEL,
} from '../teamTargetPlan.js';

const team = [
  { employee_id: 'n', name: 'Narayana', role: 'sales_manager' },
  { employee_id: 'a', name: 'Akshay', role: 'sales_manager' },
  { employee_id: 'm', name: 'Monica Ramesh', role: 'sales_manager' },
  { employee_id: 'mb', name: 'Manjula BusiReddy', role: 'sales_rep' },
  { employee_id: 'mp', name: 'Manjunath Patil', role: 'sales_rep' },
  { employee_id: 'mr', name: 'Manisha Roy', role: 'sales_rep' },
  { employee_id: 'as', name: 'Abhaya Saxena', role: 'sales_rep' },
];

describe('monthsInRange', () => {
  it('lists each calendar month, clipped to the range', () => {
    const months = monthsInRange('2026-10-15', '2027-01-10');
    expect(months.map((m) => m.label)).toEqual(['Oct 2026', 'Nov 2026', 'Dec 2026', 'Jan 2027']);
    expect(months[0]).toMatchObject({ start: '2026-10-15', end: '2026-10-31' });
    expect(months[3]).toMatchObject({ start: '2027-01-01', end: '2027-01-10' });
  });

  it('returns nothing for missing or reversed dates', () => {
    expect(monthsInRange('', '2027-01-01')).toEqual([]);
    expect(monthsInRange('2027-02-01', '2027-01-01')).toEqual([]);
  });

  it('summarizes the mockup period', () => {
    expect(periodSummary('2026-10-01', '2027-06-30')).toBe('Oct 2026 – Jun 2027 (9 Months)');
  });
});

describe('splitEvenly', () => {
  it('keeps whole counts adding up to the total', () => {
    const parts = splitEvenly(59, 9, { integer: true });
    expect(parts.reduce((a, b) => a + b, 0)).toBe(59);
    expect(Math.max(...parts) - Math.min(...parts)).toBeLessThanOrEqual(1);
  });

  it('keeps amounts adding up to the total to the paisa', () => {
    const parts = splitEvenly(10000000, 3);
    expect(Math.round(parts.reduce((a, b) => a + b, 0) * 100)).toBe(1000000000);
  });
});

describe('autoDistribute', () => {
  const rows = autoDistribute(team, { teamRevenue: 600, model: DEFAULT_TARGET_MODEL, months: 9 });

  it('splits revenue 50/50 between BDMs and BDEs like the mockup', () => {
    expect(rows.filter((r) => r.role === 'sales_manager').map((r) => r.revenue)).toEqual([100, 100, 100]);
    expect(rows.filter((r) => r.role === 'sales_rep').map((r) => r.revenue)).toEqual([75, 75, 75, 75]);
  });

  it('sets pipeline from the coverage ratio', () => {
    expect(rows[0].pipeline).toBe(440);
  });

  it('gives the whole target to the only role on the team', () => {
    const solo = autoDistribute(team.slice(3), { teamRevenue: 100, model: DEFAULT_TARGET_MODEL, months: 1 });
    expect(solo.map((r) => r.revenue)).toEqual([25, 25, 25, 25]);
  });
});

describe('summarizePlan and weeklyPerPerson', () => {
  const rows = autoDistribute(team, { teamRevenue: 600, model: DEFAULT_TARGET_MODEL, months: 9 });

  it('totals the team and the role split', () => {
    expect(summarizePlan(rows)).toMatchObject({ revenue: 600, bdmCount: 3, bdeCount: 4, bdmRevenue: 300, bdeRevenue: 300 });
  });

  it('averages a role per week', () => {
    expect(weeklyPerPerson(rows, 'sales_manager', 39).revenue).toBeCloseTo(2.56, 2);
    expect(weeklyPerPerson([], 'sales_rep', 39)).toBeNull();
  });
});

describe('breakdownRow', () => {
  it('groups months into quarters that add back up', () => {
    const months = monthsInRange('2026-10-01', '2027-06-30');
    const quarters = breakdownRow({ revenue: 100, pipeline: 530, meetings: 84, proposals: 59 }, months, 3);
    expect(quarters).toHaveLength(3);
    expect(quarters[0].label).toBe('Oct–Dec 2026');
    expect(quarters.reduce((a, q) => a + q.proposals, 0)).toBe(59);
  });
});

describe('buildMonthlyTargetForms', () => {
  it('creates one monthly target per member per month in full currency', () => {
    const forms = buildMonthlyTargetForms(
      [{ employee_id: 'n', name: 'Narayana', role: 'sales_manager', revenue: 90, pipeline: 0, meetings: 10, proposals: 4 }],
      { start: '2026-10-01', end: '2026-12-31', currency: 'INR', status: 'active' },
    );
    expect(forms).toHaveLength(3);
    expect(forms[0]).toMatchObject({
      period_type: 'monthly', period_name: 'Oct 2026', start_date: '2026-10-01', end_date: '2026-10-31',
      employee_id: 'n', role: 'sales_manager', status: 'active', revenue_target: 3000000,
    });
    expect(forms.reduce((a, f) => a + f.qualified_meetings_target, 0)).toBe(10);
  });

  it('leaves metrics that are switched off unset', () => {
    const [form] = buildMonthlyTargetForms(
      [{ employee_id: 'n', role: 'sales_rep', revenue: 1, pipeline: 1, meetings: 1, proposals: 1 }],
      { start: '2026-10-01', end: '2026-10-31', currency: 'INR', status: 'draft', metrics: ['revenue'] },
    );
    expect(form.revenue_target).toBe(100000);
    expect(form.proposal_count_target).toBe('');
  });
});

describe('CSV export/import', () => {
  it('round-trips plan values by member name', () => {
    const rows = autoDistribute(team, { teamRevenue: 600, model: DEFAULT_TARGET_MODEL, months: 9 });
    const edited = planToCsv(rows).replace('Akshay,BDM,100', 'Akshay,BDM,120') + '\nSomeone Else,BDE,1,1,1,1';
    const { rows: next, unmatched } = applyCsvToPlan(team.map((t) => ({ ...t, revenue: 0 })), edited);
    expect(next.find((r) => r.name === 'Akshay').revenue).toBe(120);
    expect(next.find((r) => r.name === 'Narayana').revenue).toBe(100);
    expect(unmatched).toEqual(['Someone Else']);
  });
});
