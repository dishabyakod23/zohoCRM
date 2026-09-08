import {
  normalizeWeeklyMemberRow,
  partitionWeeklyMembers,
  sumWeeklyMemberMetrics,
  buildWeeklyReportHtml,
  buildWeeklyReportIntroText,
  RECOMMENDED_WEEKLY_REPORT_SCHEDULE,
  weeklyReportRoleShort,
  formatWeeklyRate,
} from '../weeklyReportEmail.js';

describe('weekly team performance report helpers', () => {
  const members = [
    {
      user_id: '1',
      user_name: 'Manjunath',
      role: 'BDE',
      role_key: 'business_rep',
      emails_sent: 10,
      follow_up_emails_sent: 4,
      linkedin_connections_sent: 2,
      cold_leads: 3,
      warm_leads: 1,
      qualified_leads: 0,
      meetings_scheduled: 1,
      pipeline_created: 100000,
      revenue_generated: 0,
      cold_leads_created: 5,
      warm_conversions: 2,
      qualified_conversions: 1,
      cold_to_warm_rate: 40,
      warm_to_qualified_rate: 50,
    },
    {
      user_id: '2',
      user_name: 'Narayana',
      role: 'sales_manager',
      emails_sent: 5,
      followups_sent: 2,
      linkedin_outreach: 1,
      cold_leads: 1,
      warm_leads: 2,
      qualified_leads: 1,
      meetings_booked: 2,
      pipeline_value: 250000,
      deals_won_amount: 50000,
      cold_leads_generated: 4,
      warm_conversions: 1,
      qualified_conversions: 0,
    },
  ];

  it('maps roles to BDE/BDM short labels including display BDE', () => {
    expect(weeklyReportRoleShort('sales_rep')).toBe('BDE');
    expect(weeklyReportRoleShort('sales_manager')).toBe('BDM');
    expect(weeklyReportRoleShort('BDE')).toBe('BDE');
    expect(weeklyReportRoleShort('business_rep')).toBe('BDE');
  });

  it('normalizes alternate metric keys and keeps snapshot vs created distinct', () => {
    const row = normalizeWeeklyMemberRow(members[1]);
    expect(row.follow_up_emails_sent).toBe(2);
    expect(row.linkedin_connections_sent).toBe(1);
    expect(row.pipeline_created).toBe(250000);
    expect(row.revenue_generated).toBe(50000);
    expect(row.cold_leads).toBe(1);
    expect(row.cold_leads_created).toBe(4);
    expect(row.cold_to_warm_rate).toBe(25);
  });

  it('does not treat cold_leads_generated as module snapshot cold_leads', () => {
    const row = normalizeWeeklyMemberRow({
      cold_leads_generated: 9,
      warm_leads: 2,
    });
    expect(row.cold_leads).toBe(0);
    expect(row.cold_leads_created).toBe(9);
  });

  it('partitions BDE and BDM sections and totals metrics including conversions', () => {
    const { bdes, bdms } = partitionWeeklyMembers(members);
    expect(bdes).toHaveLength(1);
    expect(bdms).toHaveLength(1);
    const totals = sumWeeklyMemberMetrics(members);
    expect(totals.emails_sent).toBe(15);
    expect(totals.pipeline_created).toBe(350000);
    expect(totals.cold_leads_created).toBe(9);
    expect(totals.warm_conversions).toBe(3);
    expect(totals.cold_to_warm_rate).toBeCloseTo(100 / 3, 5);
  });

  it('formats conversion rates', () => {
    expect(formatWeeklyRate(40)).toBe('40%');
    expect(formatWeeklyRate(33.333)).toBe('33.3%');
  });

  it('builds the recommended Friday 3:30 IST schedule constant', () => {
    expect(RECOMMENDED_WEEKLY_REPORT_SCHEDULE).toEqual({
      day_of_week: 4,
      hour: 15,
      minute: 30,
      timezone: 'Asia/Kolkata',
    });
  });

  it('uses team_label and generated_on from preview when provided', () => {
    const html = buildWeeklyReportHtml({
      companyName: 'Origami CRM',
      periodStart: '2026-09-05',
      periodEnd: '2026-09-08',
      teamLabel: '2 BDEs + 1 BDM',
      generatedOn: '2026-09-08 15:30 IST',
      members,
    });
    expect(html).toContain('2 BDEs + 1 BDM');
    expect(html).toContain('2026-09-08 15:30 IST');
    expect(html).toContain('Saturday–Friday');
    expect(html).toContain('Module snapshot + activity');
    expect(html).toContain('Weekly conversions');
    expect(html).toContain('Cold Created (week)');
    expect(html).not.toContain('Monday–Friday');
    expect(html).not.toContain('Cold Leads Generated');
  });

  it('intro text describes Saturday–Friday digest sections', () => {
    const text = buildWeeklyReportIntroText({
      periodStart: '2026-09-05',
      periodEnd: '2026-09-11',
    });
    expect(text).toContain('2026-09-05 to 2026-09-11');
    expect(text).toMatch(/Section 1|module/i);
  });
});
