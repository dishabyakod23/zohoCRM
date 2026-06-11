'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import api from '../../lib/api.js';
import StickyNote, { isStickyNotePinned } from './StickyNote.js';

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

const ANNOUNCEMENTS = [
  { id: 1, title: 'Q3 Sales Kickoff', body: 'Join the all-hands meeting on Friday at 10 AM.', date: 'Today' },
  { id: 2, title: 'New Lead Status Values', body: 'Lead statuses have been updated per SOW v2.', date: 'Yesterday' },
  { id: 3, title: 'Weekly Report', body: 'Auto-reports are sent every Monday at 8:00 AM IST.', date: '2 days ago' },
];

function Panel({ title, onClose, children, wide }) {
  return (
    <div className={`fixed bottom-14 right-4 z-50 bg-white border border-zoho-border rounded-2xl shadow-card-hover animate-scaleIn origin-bottom-right ${wide ? 'w-96' : 'w-80'} max-h-[420px] flex flex-col`}>
      <div className="flex items-center justify-between px-4 py-3 border-b border-zoho-border bg-brand-50/60 rounded-t-2xl">
        <h3 className="text-sm font-semibold text-zoho-text">{title}</h3>
        <button onClick={onClose} className="w-6 h-6 rounded-lg flex items-center justify-center text-zoho-muted hover:text-red-500 hover:bg-red-50 text-lg leading-none transition-colors">×</button>
      </div>
      <div className="overflow-y-auto flex-1 p-4">{children}</div>
    </div>
  );
}

export default function BottomUtilityBar() {
  const [active, setActive] = useState(null);
  const [reminders, setReminders] = useState([]);
  const [recent, setRecent] = useState([]);
  const [stickyNoteOpen, setStickyNoteOpen] = useState(false);
  const [a11y, setA11y] = useState({ largeText: false, highContrast: false });

  useEffect(() => {
    const stored = localStorage.getItem('crm_recent');
    if (stored) setRecent(JSON.parse(stored));
    const a11yStored = localStorage.getItem('crm_a11y');
    if (a11yStored) setA11y(JSON.parse(a11yStored));
    if (isStickyNotePinned()) setStickyNoteOpen(true);
  }, []);

  const loadReminders = () => {
    api.get('/tasks', { params: { limit: 20 } }).then(r => {
      const tasks = r.data.data.filter(t => t.status !== 'Completed');
      setReminders(tasks.slice(0, 8));
    }).catch(() => setReminders([]));
  };

  useEffect(() => { loadReminders(); }, []);

  useEffect(() => {
    document.documentElement.classList.toggle('crm-large-text', a11y.largeText);
    document.documentElement.classList.toggle('crm-high-contrast', a11y.highContrast);
    localStorage.setItem('crm_a11y', JSON.stringify(a11y));
  }, [a11y]);

  const toggle = (key) => {
    if (key === 'recent') {
      const stored = localStorage.getItem('crm_recent');
      if (stored) setRecent(JSON.parse(stored));
    }
    setActive(prev => prev === key ? null : key);
  };

  const toggleStickyNote = () => setStickyNoteOpen(v => !v);

  const items = [
    { key: 'announcements', icon: ICONS.announcements, title: 'Announcements', label: 'Announcements' },
    { key: 'expand', icon: ICONS.expand, title: 'Open in new tab', label: 'Expand' },
    { key: 'reminders', icon: ICONS.reminders, title: 'Reminders', label: 'Reminders', badge: reminders.length },
    { key: 'recent', icon: ICONS.recent, title: 'Recent Items', label: 'Recent' },
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
          <div className="space-y-3">
            {ANNOUNCEMENTS.map(a => (
              <div key={a.id} className="p-3 rounded-xl border border-zoho-border hover:bg-brand-50/50 hover:border-brand-200 transition-colors">
                <p className="text-sm font-medium text-zoho-text">{a.title}</p>
                <p className="text-xs text-zoho-muted mt-1">{a.body}</p>
                <p className="text-[10px] text-zoho-muted mt-2">{a.date}</p>
              </div>
            ))}
          </div>
        </Panel>
      )}

      {active === 'reminders' && (
        <Panel title="Reminders" onClose={() => setActive(null)}>
          {reminders.length === 0 ? (
            <p className="text-sm text-zoho-muted text-center py-6">No pending reminders</p>
          ) : (
            <div className="space-y-2">
              {reminders.map(t => (
                <Link key={t.id} href="/tasks" onClick={() => setActive(null)}
                  className="block p-3 rounded-xl border border-zoho-border hover:bg-brand-50 hover:border-brand-200 text-sm transition-colors">
                  <p className="font-medium">{t.title}</p>
                  <p className={`text-xs mt-1 ${new Date(t.due_date) < new Date() ? 'text-red-600' : 'text-zoho-muted'}`}>
                    Due: {new Date(t.due_date).toLocaleString()}
                  </p>
                </Link>
              ))}
            </div>
          )}
        </Panel>
      )}

      {active === 'recent' && (
        <Panel title="Recent Items" onClose={() => setActive(null)}>
          {recent.length === 0 ? (
            <p className="text-sm text-zoho-muted text-center py-6">No recent items yet. Browse records to see them here.</p>
          ) : (
            <div className="space-y-1">
              {recent.map((r, i) => (
                <Link key={i} href={r.href} onClick={() => setActive(null)}
                  className="flex justify-between p-2 rounded-lg hover:bg-brand-50 text-sm transition-colors">
                  <span className="text-brand-600">{r.name}</span>
                  <span className="text-xs text-zoho-muted capitalize">{r.type}</span>
                </Link>
              ))}
            </div>
          )}
        </Panel>
      )}

      {active === 'accessibility' && (
        <Panel title="Accessibility" onClose={() => setActive(null)}>
          <div className="space-y-4 text-sm">
            <label className="flex items-center justify-between">
              <span>Larger text</span>
              <input type="checkbox" checked={a11y.largeText} onChange={e => setA11y(a => ({ ...a, largeText: e.target.checked }))} />
            </label>
            <label className="flex items-center justify-between">
              <span>High contrast</span>
              <input type="checkbox" checked={a11y.highContrast} onChange={e => setA11y(a => ({ ...a, highContrast: e.target.checked }))} />
            </label>
            <p className="text-xs text-zoho-muted">Settings are saved to your browser.</p>
          </div>
        </Panel>
      )}

      {active === 'help' && (
        <Panel title="Help" onClose={() => setActive(null)} wide>
          <div className="space-y-3 text-sm">
            <a href="https://www.zoho.com/crm/help/" target="_blank" rel="noreferrer" className="block p-3 rounded-xl border border-zoho-border hover:bg-brand-50 hover:border-brand-200 text-brand-600 transition-colors font-medium">
              Zoho CRM Help Documentation →
            </a>
            <div className="p-3 rounded-xl bg-brand-50/40 border border-zoho-border">
              <p className="font-medium mb-2">Quick Tips</p>
              <ul className="text-xs text-zoho-muted space-y-1.5 list-disc pl-4">
                <li>Use the + button to quickly create records</li>
                <li>Global search finds leads, contacts, deals & more</li>
                <li>Drag deals in Kanban view to change stage</li>
                <li>Convert leads to accounts, contacts & deals</li>
                <li>Deleted records go to Recycle Bin for 30 days</li>
              </ul>
            </div>
            <p className="text-xs text-zoho-muted">Demo: disha@demo.com / demo1234</p>
          </div>
        </Panel>
      )}
    </>
  );
}

/** Call this when user views a record to populate Recent Items */
export function trackRecentItem({ type, id, name }) {
  if (typeof window === 'undefined') return;
  const href = `/${type}s/${id}`;
  const stored = JSON.parse(localStorage.getItem('crm_recent') || '[]');
  const filtered = stored.filter(r => r.href !== href);
  const updated = [{ type, id, name, href, time: Date.now() }, ...filtered].slice(0, 10);
  localStorage.setItem('crm_recent', JSON.stringify(updated));
}
