'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import StickyNote, { isStickyNotePinned } from './StickyNote.js';
import { getRecentItemHref } from '../../lib/recentItemHelpers.js';
import * as calendarApi from '../../lib/services/calendar.js';
import * as announcementsApi from '../../lib/services/announcements.js';
import * as auditLogsApi from '../../lib/services/auditLogs.js';
import { formatAnnouncementDate } from '../../lib/services/announcements.js';
import { formatEnumLabel } from '../../lib/activityHelpers.js';
import { useAuth } from '../../hooks/useAuth.js';
import { usePermissions } from '../../hooks/usePermissions.js';
import { useToast } from '../ui/Toast.js';
import { getApiError } from '../../lib/api.js';
import ReminderItem from '../calendar/ReminderItem.js';

const ICONS = {
  announcements: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
    </svg>
  ),
  expand: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
    </svg>
  ),
  reminders: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  recent: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z M3 3v5h5" />
    </svg>
  ),
  accessibility: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
    </svg>
  ),
  notes: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 3h7l5 5v11a1 1 0 01-1 1H7a1 1 0 01-1-1V4a1 1 0 011-1z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M14 3v5h5" />
    </svg>
  ),
};

const TEXT_SCALE_MIN = 0;
const TEXT_SCALE_MAX = 5;
const TEXT_SCALE_LABELS = ['Default', 'Comfort', 'Large', 'Larger', 'Extra large', 'Maximum'];

function parseAuditValue(value) {
  if (value == null) return null;
  if (typeof value === 'object') return value;
  const text = String(value).trim();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function extractDisplayName(value) {
  const parsed = parseAuditValue(value);
  if (!parsed) return '';
  if (typeof parsed === 'string') return parsed;
  if (typeof parsed !== 'object') return String(parsed);
  const first = parsed.first_name || parsed.firstName || '';
  const last = parsed.last_name || parsed.lastName || '';
  const full = `${first} ${last}`.trim();
  return full
    || parsed.name
    || parsed.title
    || parsed.subject
    || parsed.deal_name
    || parsed.account_name
    || parsed.company
    || parsed.email
    || '';
}

function formatValue(value) {
  const parsed = parseAuditValue(value);
  if (!parsed) return '';
  if (typeof parsed === 'string') return formatEnumLabel(parsed);
  if (typeof parsed !== 'object') return String(parsed);
  const label = extractDisplayName(parsed);
  if (label) return label;
  return Object.entries(parsed)
    .filter(([, v]) => v != null && v !== '')
    .slice(0, 2)
    .map(([k, v]) => `${formatEnumLabel(k)}: ${String(v)}`)
    .join(', ');
}

function buildAuditMessage(log) {
  const action = String(log.action || '').toLowerCase();
  const entity = formatEnumLabel(log.entity_type || log.record_type || 'record').toLowerCase();
  const name = extractDisplayName(log.new_value) || extractDisplayName(log.old_value);
  const oldVal = formatValue(log.old_value);
  const newVal = formatValue(log.new_value);
  const field = formatEnumLabel(log.field_name || '');

  if (action.includes('create')) {
    return `Created new ${entity}${name ? ` - ${name}` : ''}`;
  }
  if (action.includes('delete')) {
    return `Deleted ${entity}${name ? ` - ${name}` : ''}`;
  }
  if (action.includes('update')) {
    const isStatusChange = ['status', 'lead_status'].includes(String(log.field_name || '').toLowerCase());
    if (isStatusChange && oldVal && newVal) {
      if (name) return `Updated ${oldVal.toLowerCase()} ${name} to ${newVal.toLowerCase()} ${name}`;
      return `Updated ${entity} from ${oldVal} to ${newVal}`;
    }
    if (field && oldVal && newVal) {
      return `Updated ${entity}${name ? ` - ${name}` : ''} (${field}: ${oldVal} -> ${newVal})`;
    }
    return `Updated ${entity}${name ? ` - ${name}` : ''}`;
  }
  return `${formatEnumLabel(log.action) || 'Updated'} ${entity}${name ? ` - ${name}` : ''}`;
}

function StepButton({ onClick, disabled, label, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="w-8 h-8 rounded-lg border border-zoho-border flex items-center justify-center text-zoho-text hover:bg-brand-50 hover:border-brand-300 disabled:opacity-35 disabled:cursor-not-allowed disabled:hover:bg-white transition-colors"
    >
      {children}
    </button>
  );
}

function Panel({ title, onClose, children, wide }) {
  return (
    <div className={`fixed bottom-14 right-4 z-50 crm-a11y-panel bg-white border border-zoho-border rounded-2xl shadow-card-hover animate-scaleIn origin-bottom-right ${wide ? 'w-96' : 'w-80'} max-h-[420px] flex flex-col`}>
      <div className="crm-a11y-panel-header flex items-center justify-between px-4 py-3 border-b border-zoho-border bg-brand-50/60 rounded-t-2xl">
        <h3 className="text-sm font-semibold text-zoho-text">{title}</h3>
        <button onClick={onClose} className="w-6 h-6 rounded-lg flex items-center justify-center text-zoho-muted hover:text-red-500 hover:bg-red-50 text-lg leading-none transition-colors">×</button>
      </div>
      <div className="overflow-y-auto flex-1 p-4">{children}</div>
    </div>
  );
}

export default function BottomUtilityBar() {
  const { user } = useAuth();
  const { canAssignLeads, role } = usePermissions();
  const { showToast } = useToast();
  const [active, setActive] = useState(null);
  const [reminders, setReminders] = useState([]);
  const [completingReminderId, setCompletingReminderId] = useState(null);
  const [announcements, setAnnouncements] = useState([]);
  const [announcementsLoading, setAnnouncementsLoading] = useState(false);
  const [auditLogs, setAuditLogs] = useState([]);
  const [auditLogsLoading, setAuditLogsLoading] = useState(false);
  const [stickyNoteOpen, setStickyNoteOpen] = useState(false);
  const [a11y, setA11y] = useState({ textScale: 0, colorMode: 'light' });

  useEffect(() => {
    const a11yStored = localStorage.getItem('crm_a11y');
    if (a11yStored) {
      const parsed = JSON.parse(a11yStored);
      if (parsed.largeText && parsed.textScale == null) {
        parsed.textScale = 1;
        delete parsed.largeText;
      }
      setA11y({
        textScale: Math.min(TEXT_SCALE_MAX, Math.max(TEXT_SCALE_MIN, Number(parsed.textScale) || 0)),
        colorMode: parsed.colorMode === 'dark' ? 'dark' : 'light',
      });
    }
    if (isStickyNotePinned()) setStickyNoteOpen(true);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.textScale = String(a11y.textScale ?? 0);
    document.documentElement.classList.remove('crm-large-text', 'crm-high-contrast');
    document.documentElement.classList.toggle('crm-dark', a11y.colorMode === 'dark');
    localStorage.setItem('crm_a11y', JSON.stringify(a11y));
  }, [a11y]);

  useEffect(() => {
    if (!user?.id) return;
    calendarApi.getLoginReminders()
      .then(setReminders)
      .catch(() => setReminders([]));
    announcementsApi.listAnnouncements({ limit: 20 })
      .then(setAnnouncements)
      .catch(() => setAnnouncements([]));
  }, [user?.id, canAssignLeads]);

  const loadAuditLogs = async () => {
    if (!user?.id) return;
    setAuditLogsLoading(true);
    try {
      const logs = await auditLogsApi.listAuditLogs({ page: 1, page_size: 100 });
      const canSeeAllLogs = role === 'super_admin' || role === 'sales_manager';
      setAuditLogs(canSeeAllLogs ? logs : logs.filter((l) => l.user_id === user.id));
    } catch {
      setAuditLogs([]);
    } finally {
      setAuditLogsLoading(false);
    }
  };

  const loadAnnouncements = () => {
    setAnnouncementsLoading(true);
    return announcementsApi.listAnnouncements({ limit: 20 })
      .then(setAnnouncements)
      .catch(() => setAnnouncements([]))
      .finally(() => setAnnouncementsLoading(false));
  };

  const markReminderComplete = async (event) => {
    setCompletingReminderId(event.id);
    try {
      await calendarApi.updateEvent(event.id, { completed: true });
      setReminders((prev) => prev.filter((r) => r.id !== event.id));
      showToast('Marked as done', 'success');
    } catch (err) {
      showToast(getApiError(err));
    } finally {
      setCompletingReminderId(null);
    }
  };

  const toggle = (key) => {
    if (key === 'audit') {
      loadAuditLogs();
    }
    if (key === 'reminders') {
      calendarApi.getLoginReminders()
        .then(setReminders)
        .catch(() => setReminders([]));
    }
    if (key === 'announcements') {
      loadAnnouncements();
    }
    setActive(prev => prev === key ? null : key);
  };

  const toggleStickyNote = () => setStickyNoteOpen(v => !v);

  const items = [
    { key: 'announcements', icon: ICONS.announcements, title: 'Announcements', label: 'Announcements', badge: announcements.length },
    { key: 'expand', icon: ICONS.expand, title: 'Open in new tab', label: 'Expand' },
    { key: 'reminders', icon: ICONS.reminders, title: 'Reminders', label: 'Reminders', badge: reminders.length },
    { key: 'audit', icon: ICONS.recent, title: 'Audit Logs', label: 'Audit Logs' },
    { key: 'accessibility', icon: ICONS.accessibility, title: 'Accessibility', label: 'Accessibility' },
  ];

  return (
    <>
      <footer className="h-12 bg-white/80 backdrop-blur-md border-t border-zoho-border flex items-stretch shrink-0 z-40">
        {items.map((item, i) => (
          <button
            key={item.key}
            onClick={() => item.key === 'expand' ? window.open(window.location.href, '_blank') : toggle(item.key)}
            title={item.label}
            className={`relative flex-1 flex items-center justify-center border-r border-zoho-border last:border-r-0 transition-colors duration-150 hover:bg-brand-50 ${
              active === item.key ? 'bg-brand-50 text-brand-600' : 'text-zoho-muted hover:text-brand-600'
            }`}
          >
            {item.icon}
            {item.badge > 0 && (
              <span className="absolute top-1.5 right-[calc(50%-14px)] w-4 h-4 bg-accent-pink text-white text-[9px] rounded-full flex items-center justify-center font-bold ring-4 ring-accent-pink/20">
                {item.badge}
              </span>
            )}
          </button>
        ))}

        {/* Help button - vibrant gradient */}
        <button
          onClick={() => toggle('help')}
          className={`flex items-center gap-2 px-6 shrink-0 bg-brand-gradient transition-opacity ${
            active === 'help' ? 'opacity-90' : 'hover:opacity-90'
          }`}
        >
          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="text-white text-sm font-semibold">Help</span>
        </button>

        {/* Sticky note toggle */}
        <button
          onClick={toggleStickyNote}
          title="Sticky Notes"
          className={`w-14 shrink-0 flex items-center justify-center border-l border-zoho-border transition-colors duration-150 hover:bg-brand-50 ${
            stickyNoteOpen ? 'bg-brand-50 text-brand-600' : 'text-zoho-muted hover:text-brand-600'
          }`}
        >
          {ICONS.notes}
        </button>
      </footer>

      <StickyNote
        visible={stickyNoteOpen}
        onClose={() => setStickyNoteOpen(false)}
      />

      {active === 'announcements' && (
        <Panel title="Announcements" onClose={() => setActive(null)}>
          {announcementsLoading ? (
            <p className="text-sm text-zoho-muted text-center py-6">Loading announcements…</p>
          ) : announcements.length === 0 ? (
            <p className="text-sm text-zoho-muted text-center py-6">No announcements right now</p>
          ) : (
            <div className="space-y-3">
              {announcements.map((a) => (
                <div key={a.id} className="p-3 rounded-xl border border-zoho-border hover:bg-brand-50/50 hover:border-brand-200 transition-colors">
                  <p className="text-sm font-medium text-zoho-text">{a.title}</p>
                  <p className="text-xs text-zoho-muted mt-1 whitespace-pre-wrap">{a.body}</p>
                  <p className="text-[10px] text-zoho-muted mt-2">
                    {formatAnnouncementDate(a.created_at)}
                    {a.created_by_name ? ` · ${a.created_by_name}` : ''}
                  </p>
                </div>
              ))}
            </div>
          )}
        </Panel>
      )}

      {active === 'reminders' && (
        <Panel title="Reminders" onClose={() => setActive(null)}>
          {reminders.length === 0 ? (
            <p className="text-sm text-zoho-muted text-center py-6">No pending reminders</p>
          ) : (
            <div className="space-y-2">
              {reminders.map((t) => (
                <ReminderItem
                  key={t.id}
                  event={t}
                  onComplete={markReminderComplete}
                  completing={completingReminderId === t.id}
                  onNavigate={() => setActive(null)}
                />
              ))}
            </div>
          )}
        </Panel>
      )}

      {active === 'audit' && (
        <Panel title="Audit Logs" onClose={() => setActive(null)}>
          {auditLogsLoading ? (
            <p className="text-sm text-zoho-muted text-center py-6">Loading audit logs…</p>
          ) : auditLogs.length === 0 ? (
            <p className="text-sm text-zoho-muted text-center py-6">No audit logs found.</p>
          ) : (
            <div className="space-y-2">
              {auditLogs.map((log) => (
                <div key={log.id} className="p-3 rounded-xl border border-zoho-border hover:bg-brand-50/40 transition-colors">
                  <p className="text-sm font-medium text-zoho-text">
                    {log.summary || buildAuditMessage(log)}
                  </p>
                  <p className="text-xs text-zoho-muted mt-1">
                    {log.user_name || 'System'} · {log.created_at ? new Date(log.created_at).toLocaleString() : '—'}
                  </p>
                </div>
              ))}
            </div>
          )}
        </Panel>
      )}

      {active === 'accessibility' && (
        <Panel title="Accessibility" onClose={() => setActive(null)}>
          <div className="space-y-4 text-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <span className="block font-medium">Text size</span>
                <span className="text-xs text-zoho-muted">{TEXT_SCALE_LABELS[a11y.textScale] ?? 'Default'}</span>
              </div>
              <div className="flex items-center gap-2">
                <StepButton
                  label="Decrease text size"
                  disabled={a11y.textScale <= TEXT_SCALE_MIN}
                  onClick={() => setA11y((a) => ({ ...a, textScale: Math.max(TEXT_SCALE_MIN, a.textScale - 1) }))}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                  </svg>
                </StepButton>
                <span className="w-5 text-center text-xs font-semibold tabular-nums text-zoho-muted">{a11y.textScale}</span>
                <StepButton
                  label="Increase text size"
                  disabled={a11y.textScale >= TEXT_SCALE_MAX}
                  onClick={() => setA11y((a) => ({ ...a, textScale: Math.min(TEXT_SCALE_MAX, a.textScale + 1) }))}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                </StepButton>
              </div>
            </div>
            <div className="flex gap-1" aria-hidden="true">
              {Array.from({ length: TEXT_SCALE_MAX + 1 }, (_, i) => (
                <span
                  key={i}
                  className={`h-1.5 flex-1 rounded-full transition-colors ${i <= a11y.textScale ? 'bg-brand-500' : 'bg-neutral-200'}`}
                />
              ))}
            </div>
            <div>
              <span className="block font-medium mb-2">Theme</span>
              <div className="flex rounded-lg border border-zoho-border p-1 bg-neutral-50">
                <button
                  type="button"
                  onClick={() => setA11y((a) => ({ ...a, colorMode: 'light' }))}
                  className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors ${
                    a11y.colorMode !== 'dark' ? 'bg-white shadow-sm text-zoho-text' : 'text-zoho-muted hover:text-zoho-text'
                  }`}
                >
                  Light
                </button>
                <button
                  type="button"
                  onClick={() => setA11y((a) => ({ ...a, colorMode: 'dark' }))}
                  className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors ${
                    a11y.colorMode === 'dark' ? 'bg-neutral-800 text-white shadow-sm' : 'text-zoho-muted hover:text-zoho-text'
                  }`}
                >
                  Dark
                </button>
              </div>
            </div>
            <p className="text-xs text-zoho-muted">Settings are saved to your browser.</p>
          </div>
        </Panel>
      )}

      {active === 'help' && (
        <Panel title="Help" onClose={() => setActive(null)} wide>
          <div className="space-y-3 text-sm">
            <Link href="/help" onClick={() => setActive(null)} className="block p-3 rounded-xl border border-zoho-border hover:bg-brand-50 hover:border-brand-200 text-brand-600 transition-colors font-medium">
              CRM Help Documentation →
            </Link>
            <div className="p-3 rounded-xl bg-brand-50/40 border border-zoho-border">
              <p className="font-medium mb-2">Quick Tips</p>
              <ul className="text-xs text-zoho-muted space-y-1.5 list-disc pl-4">
                <li>Use the + button to quickly create records</li>
                <li>Global search finds leads, contacts, and accounts</li>
                <li>Move leads through Raw → Qualified → Proposal stages</li>
                <li>Convert leads to accounts and contacts</li>
              </ul>
            </div>
            <p className="text-xs text-zoho-muted">API: api-salescrm.duckdns.org</p>
          </div>
        </Panel>
      )}
    </>
  );
}

/** Call this when user views a record to populate Recent Items */
export function trackRecentItem({ type, id, name, href, pipelineStage, lead }) {
  if (typeof window === 'undefined') return;
  const resolvedHref = href || getRecentItemHref({ type, id, pipelineStage, lead });
  const stored = JSON.parse(localStorage.getItem('crm_recent') || '[]');
  const filtered = stored.filter(r => r.href !== resolvedHref);
  const updated = [{ type, id, name, href: resolvedHref, time: Date.now() }, ...filtered].slice(0, 10);
  localStorage.setItem('crm_recent', JSON.stringify(updated));
}
