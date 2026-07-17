'use client';
import { useState } from 'react';
import Link from 'next/link';
import RecordNotesTab from './RecordNotesTab.js';
import RecordActivitiesTab from './RecordActivitiesTab.js';
import RecordHistoryTab from './RecordHistoryTab.js';
import { notesSupportedRelatedType } from '../../lib/noteHelpers.js';
import ClickToCallButton from '../cloudtalk/ClickToCallButton.js';
import { normalizePhoneForDial } from '../../lib/cloudTalkHelpers.js';

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
  tabs,
  defaultTab = 'Overview',
  recordNotes,
  recordActivities,
  recordHistory,
  children,
  tabContent,
}) {
  const showNotes = recordNotes?.relatedType
    && recordNotes?.recordId
    && notesSupportedRelatedType(recordNotes.relatedType);
  const showActivities = recordActivities?.entityType && recordActivities?.recordId;
  const showHistory = recordHistory?.entityType && recordHistory?.recordId;
  const resolvedTabs = tabs ?? [
    'Overview',
    ...(showNotes ? ['Notes'] : []),
    ...(showActivities ? ['Activities'] : []),
    ...(showHistory ? ['History'] : []),
  ];
  const [activeTab, setActiveTab] = useState(defaultTab);

  const initials = avatarLabel || title?.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();

  const renderTabBody = (tab) => {
    if (tabContent) return tabContent(tab);
    if (tab === 'Notes' && showNotes && recordNotes) {
      return <RecordNotesTab relatedType={recordNotes.relatedType} recordId={recordNotes.recordId} canEdit={recordNotes.canEdit} />;
    }
    if (tab === 'Activities' && showActivities) {
      return <RecordActivitiesTab entityType={recordActivities.entityType} recordId={recordActivities.recordId} />;
    }
    if (tab === 'History' && showHistory) {
      return <RecordHistoryTab entityType={recordHistory.entityType} recordId={recordHistory.recordId} />;
    }
    if (tab === defaultTab || tab === resolvedTabs[0]) return children;
    return null;
  };

  return (
    <div className="min-h-full">
      <div className="zoho-record-header">
        <Link href={backHref} className="inline-flex items-center gap-1.5 text-xs font-medium text-zoho-muted hover:text-brand-600 transition-colors">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          {backLabel}
        </Link>
        <div className="flex items-start justify-between mt-4 gap-4 flex-wrap">
          <div className="flex items-start gap-4 min-w-0">
            <div className="w-12 h-12 rounded-xl bg-brand-gradient text-white flex items-center justify-center font-semibold text-base shadow-soft shrink-0">
              {initials}
            </div>
            <div className="min-w-0">
              <h1 className="text-lg font-semibold text-zoho-text truncate">{title}</h1>
              {subtitle && <p className="text-sm text-zoho-muted mt-0.5">{subtitle}</p>}
              {badges && <div className="flex gap-2 mt-2 flex-wrap">{badges}</div>}
              {lastUpdated && <p className="text-[11px] text-zoho-muted mt-1.5">Updated {lastUpdated}</p>}
            </div>
          </div>
          <div className="flex gap-2 flex-wrap items-start">{actions}</div>
        </div>
      </div>

      <div className="zoho-record-tabs">
        {resolvedTabs.map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`zoho-record-tab ${activeTab === tab ? 'zoho-record-tab-active' : 'zoho-record-tab-inactive'}`}>
            {tab}
          </button>
        ))}
      </div>

      <div className="p-6">
        <div className={sidebar ? 'grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_300px] gap-4 items-start' : ''}>
          <div className="min-w-0">
            {renderTabBody(activeTab)}
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
export function InfoRow({ icon, label, value, href, callNumber }) {
  const dialTarget = callNumber
    ?? (href?.startsWith('tel:') ? href.slice(4) : null);
  // Only offer click-to-call for explicit phone targets — never guess from email/company text.
  const canCall = Boolean(value && dialTarget && normalizePhoneForDial(dialTarget));

  const content = (
    <div className="flex items-center gap-3 py-2.5">
      <div className="w-8 h-8 rounded-lg bg-brand-50 text-brand-600 flex items-center justify-center shrink-0 text-sm">{icon}</div>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] text-zoho-muted font-medium uppercase tracking-wider">{label}</p>
        <p className="text-sm text-zoho-text truncate mt-0.5">{value || '—'}</p>
      </div>
      {canCall && <ClickToCallButton number={dialTarget} label={`Call ${label}`} size="xs" />}
    </div>
  );
  if (href && value && !canCall) return <a href={href} className="block hover:bg-brand-50/50 -mx-3 px-3 rounded-lg transition-colors">{content}</a>;
  if (canCall) {
    return <div className="block hover:bg-brand-50/50 -mx-3 px-3 rounded-lg transition-colors">{content}</div>;
  }
  return content;
}

/** Section card used to group fields in record overview tabs */
export function FieldSection({ title, fields }) {
  return (
    <div className="card p-5">
      <h3 className="text-xs font-semibold text-zoho-muted uppercase tracking-wider mb-4">{title}</h3>
      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4 text-sm">
        {fields.map(([k, v]) => (
          <div key={k}>
            <dt className="text-[11px] text-zoho-muted font-medium uppercase tracking-wider mb-1">{k}</dt>
            <dd className="text-zoho-text">{v || <span className="text-zoho-muted/50">—</span>}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
