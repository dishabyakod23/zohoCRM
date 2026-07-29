'use client';
import { useCallback, useEffect, useRef } from 'react';
import { useAuth } from './useAuth.js';
import { useToast } from '../components/ui/Toast.js';
import { getApiError } from '../lib/api.js';
import { getRolePermissions } from '../lib/roles.js';
import { getAdminSettings } from '../lib/services/admin.js';
import { triggerWeeklyReport } from '../lib/services/reports.js';
import { isWeeklyReportDue, weeklyReportSlotKey } from '../lib/weeklyReportSchedule.js';

const CHECK_MS = 30000;
const SETTINGS_REFRESH_MS = 5 * 60 * 1000;
const STORAGE_KEY = 'weeklyReportLastTriggerSlot';

export function WeeklyReportScheduler() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const settingsRef = useRef(null);
  const triggeringRef = useRef(false);
  const permissions = getRolePermissions(user?.role);

  const refreshSettings = useCallback(async () => {
    if (!permissions.canManageWeeklyReports) {
      settingsRef.current = null;
      return null;
    }
    try {
      const settings = await getAdminSettings();
      settingsRef.current = settings?.weekly_report || null;
      return settingsRef.current;
    } catch {
      return settingsRef.current;
    }
  }, [permissions.canManageWeeklyReports]);

  const maybeTrigger = useCallback(async () => {
    const settings = settingsRef.current;
    if (!settings?.enabled || triggeringRef.current) return;

    if (!isWeeklyReportDue(settings)) return;

    const slotKey = weeklyReportSlotKey(settings);
    if (!slotKey) return;

    let lastSlot = '';
    try {
      lastSlot = localStorage.getItem(STORAGE_KEY) || '';
    } catch {
      /* ignore */
    }
    if (lastSlot === slotKey) return;

    triggeringRef.current = true;
    try {
      const result = await triggerWeeklyReport();
      try {
        localStorage.setItem(STORAGE_KEY, slotKey);
      } catch {
        /* ignore */
      }
      showToast(
        result?.message || `Weekly reports sent (${result?.sent_count ?? 0} recipient(s))`,
        'success',
      );
    } catch (err) {
      showToast(getApiError(err));
    } finally {
      triggeringRef.current = false;
    }
  }, [showToast]);

  useEffect(() => {
    if (!user?.id || !permissions.canManageWeeklyReports) {
      settingsRef.current = null;
      return undefined;
    }

    let cancelled = false;

    const tick = async () => {
      if (cancelled) return;
      await maybeTrigger();
    };

    refreshSettings().then(() => {
      if (!cancelled) tick();
    });

    const checkTimer = setInterval(tick, CHECK_MS);
    const settingsTimer = setInterval(() => refreshSettings(), SETTINGS_REFRESH_MS);
    const onFocus = () => {
      refreshSettings().then(tick);
    };
    window.addEventListener('focus', onFocus);

    return () => {
      cancelled = true;
      clearInterval(checkTimer);
      clearInterval(settingsTimer);
      window.removeEventListener('focus', onFocus);
    };
  }, [user?.id, permissions.canManageWeeklyReports, refreshSettings, maybeTrigger]);

  return null;
}
