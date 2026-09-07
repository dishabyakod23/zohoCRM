'use client';

/**
 * Weekly report sending is owned by the backend scheduler.
 * Do not auto-trigger POST /admin/reports/weekly/trigger from the browser —
 * that re-sends mail when an admin has CRM open even after the scheduled job already ran.
 * Manual send remains available on Reports / Settings via triggerWeeklyReport().
 */
export function WeeklyReportScheduler() {
  return null;
}
