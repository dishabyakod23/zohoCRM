import {
  normalizeWeeklyMemberRow,
  partitionWeeklyMembers,
  sumWeeklyMemberMetrics,
  buildWeeklyReportHtml,
  buildWeeklyReportIntroText,
  RECOMMENDED_WEEKLY_REPORT_SCHEDULE,
  weeklyReportRoleShort,
} from '../weeklyReportEmail.js';

describe('weekly team performance report helpers', () => {
  const members = [
    {
      user_id: '1',
      user_name: 'Manjunath',
      role: 'sales_rep',
      emails_sent: 10,
      follow_up_emails_sent: 4,
      linkedin_connections_sent: 2,
      cold_leads: 3,
      warm_leads: 1,
      qualified_leads: 0,
      meetings_scheduled: 1,
      pipeline_created: 100000,
      revenue_generated: 0,
    },
    {
      user_id: '2',
      user_name: 'Narayana',
      role: 'sales_manager',
      emails_sent: 5,
      followups_sent: 2,
      linkedin_outreach: 1,
      cold_leads_generated: 1,
      warm_leads_generated: 2,
      qualified_leads_generated: 1,
      meetings_booked: 2,
      pipeline_value: 250000,
      deals_won_amount: 50000,
    },
  ];

  it('maps roles to BDE/BDM short labels', () => {
    expect(weeklyReportRoleShort('sales_rep')).toBe('BDE');
    expect(weeklyReportRoleShort('sales_manager')).toBe('BDM');
  });

  it('normalizes alternate metric keys from the API', () => {
    const row = normalizeWeeklyMemberRow(members[1]);
    expect(row.follow_up_emails_sent).toBe(2);
    expect(row.linkedin_connections_sent).toBe(1);
    expect(row.pipeline_created).toBe(250000);
    expect(row.revenue_generated).toBe(50000);
  });

  it('partitions BDE and BDM sections and totals metrics', () => {
    const { bdes, bdms } = partitionWeeklyMembers(members);
    expect(bdes).toHaveLength(1);
    expect(bdms).toHaveLength(1);
    const totals = sumWeeklyMemberMetrics(members);
    expect(totals.emails_sent).toBe(15);
    expect(totals.pipeline_created).toBe(350000);
  });

  it('builds the recommended Friday 3:30 IST schedule constant', () => {
    expect(RECOMMENDED_WEEKLY_REPORT_SCHEDULE).toEqual({
      day_of_week: 4,
      hour: 15,
      minute: 30,
      timezone: 'Asia/Kolkata',
    });
  });

  it('prefers name field and defaults missing metrics to 0', () => {
    const row = normalizeWeeklyMemberRow({
      name: 'Priya',
      user_name: 'Ignored',
      role: 'sales_rep',
    });
    expect(row.name).toBe('Priya');
    expect(row.emails_sent).toBe(0);
    expect(row.follow_up_emails_sent).toBe(0);
    expect(row.linkedin_connections_sent).toBe(0);
    expect(row.cold_leads).toBe(0);
    expect(row.warm_leads).toBe(0);
    expect(row.qualified_leads).toBe(0);
    expect(row.meetings_scheduled).toBe(0);
    expect(row.pipeline_created).toBe(0);
    expect(row.revenue_generated).toBe(0);
  });

  it('uses team_label and generated_on from preview when provided', () => {
    const html = buildWeeklyReportHtml({
      companyName: 'Origami CRM',
      periodStart: '2026-09-01',
      periodEnd: '2026-09-05',
      teamLabel: '2 BDEs + 1 BDM',
      generatedOn: '2026-09-05 15:30 IST',
      members,
    });
    expect(html).toContain('2 BDEs + 1 BDM');
    expect(html).toContain('2026-09-05 15:30 IST');
  });
});
