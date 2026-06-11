'use client';
import { useState } from 'react';
import Link from 'next/link';

/**
 * Zoho-style record detail page shell: gradient header with avatar,
 * pill tabs, and a two-column body (main content + sticky sidebar).
 */
export default function RecordDetailLayout({
  backHref,
  backLabel,
  title,
  subtitle,
  badges,
  lastUpdated,
  actions,
  avatarLabel,
  sidebar,
  tabs = ['Overview'],
  defaultTab = 'Overview',
  children,
  tabContent,
}) {
  const [activeTab, setActiveTab] = useState(defaultTab);

  const initials = avatarLabel || title?.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();

  return (
    <div className="min-h-full">
      <div className="zoho-record-header">
        <Link href={backHref} className="inline-flex items-center gap-1 text-xs font-medium text-brand-600 hover:text-brand-700 hover:gap-1.5 transition-all">
          <span aria-hidden>←</span> {backLabel}
        </Link>
        <div className="flex items-start justify-between mt-3 gap-4 flex-wrap">
          <div className="flex items-start gap-4 min-w-0">
            <div className="w-14 h-14 rounded-2xl bg-brand-gradient text-white flex items-center justify-center font-bold text-lg shadow-soft shrink-0">
              {initials}
            </div>
            <div className="min-w-0">
              <h1 className="text-xl font-bold text-zoho-text truncate">{title}</h1>
              {subtitle && <p className="text-sm text-zoho-muted mt-0.5">{subtitle}</p>}
              {badges && <div className="flex gap-2 mt-2 flex-wrap">{badges}</div>}
              {lastUpdated && <p className="text-[11px] text-zoho-muted mt-2">Last Updated: {lastUpdated}</p>}
            </div>
          </div>
          <div className="flex gap-2 flex-wrap justify-end">{actions}</div>
        </div>
      </div>

      <div className="zoho-record-tabs">
        {tabs.map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`zoho-record-tab ${activeTab === tab ? 'zoho-record-tab-active' : 'zoho-record-tab-inactive'}`}>
            {tab}
          </button>
        ))}
      </div>

      <div className="p-6">
        <div className={sidebar ? 'grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_300px] gap-4 items-start' : ''}>
          <div className="min-w-0">
            {tabContent ? tabContent(activeTab) : (activeTab === defaultTab ? children : (
              <div className="card p-8 text-center text-zoho-muted text-sm">{activeTab} — coming soon</div>
            ))}
          </div>
          {sidebar && (
            <div className="space-y-4 xl:sticky xl:top-[6.5rem]">
              {sidebar}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/** Small labeled icon row used in record sidebars */
export function InfoRow({ icon, label, value, href }) {
  const content = (
    <div className="flex items-start gap-3 py-2">
      <div className="w-8 h-8 rounded-lg bg-brand-50 text-brand-600 flex items-center justify-center shrink-0">{icon}</div>
      <div className="min-w-0">
        <p className="text-[11px] text-zoho-muted uppercase tracking-wide font-semibold">{label}</p>
        <p className="text-sm text-zoho-text truncate">{value || '—'}</p>
      </div>
    </div>
  );
  if (href && value) return <a href={href} className="block hover:bg-brand-50/60 -mx-2 px-2 rounded-lg transition-colors">{content}</a>;
  return content;
}

/** Section card used to group fields in record overview tabs */
export function FieldSection({ title, fields }) {
  return (
    <div className="card p-5">
      <h3 className="text-xs font-bold text-brand-700/80 uppercase tracking-wide mb-4">{title}</h3>
      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
        {fields.map(([k, v]) => (
          <div key={k}>
            <dt className="text-zoho-muted text-[11px] font-semibold uppercase tracking-wide mb-0.5">{k}</dt>
            <dd className="text-zoho-text">{v || <span className="text-zoho-muted/60">—</span>}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
