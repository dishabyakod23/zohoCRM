'use client';
import Link from 'next/link';
import CRMLayout from '../../components/layout/CRMLayout.js';

const SECTIONS = [
  {
    title: 'Getting started',
    items: [
      { q: 'How do I create a record?', a: 'Use the + button in the header or open any module list and click Create. Leads, contacts, accounts, and deals each have their own create form.' },
      { q: 'Where is global search?', a: 'The search bar in the top header finds leads, contacts, and accounts across the CRM.' },
      { q: 'What is Work Items?', a: 'Work Items shows only the leads assigned to you, across every pipeline stage, in one place.' },
    ],
  },
  {
    title: 'Sales pipeline',
    items: [
      { q: 'What are the lead stages?', a: 'Raw Leads → Leads → Qualified Leads → Proposals. Move records forward as they progress through your sales process.' },
      { q: 'How do I convert a lead?', a: 'Open a lead and use the Convert menu to move it to the next stage, or convert it into an account and contact.' },
      { q: 'Can I bulk update leads?', a: 'Yes. Select records on a list page, then use Mass Update from the toolbar.' },
    ],
  },
  {
    title: 'Reports & performance',
    items: [
      { q: 'Individual performance reports', a: 'Managers and admins can preview a weekly sales status report for any team member under Reports → Individual Performance, then send it to admins and managers.' },
      { q: 'Weekly reports', a: 'Admins can configure automated weekly reports under Reports → Weekly Reports. Recipients receive individual performance summaries for the team.' },
    ],
  },
  {
    title: 'Calendar & tasks',
    items: [
      { q: 'Calendar events', a: 'Open Calendar from the sidebar to view tasks, meetings, and calls. Double-click a day to create an event on that date.' },
      { q: 'Reminders', a: 'Overdue and today’s calendar items appear in the Reminders panel on the bottom utility bar. Mark items done there or from the Calendar page.' },
    ],
  },
  {
    title: 'Lists, filters & recycle bin',
    items: [
      { q: 'Filters', a: 'List pages show filters by default. Use search, status, owner, and other filters, then clear them when needed.' },
      { q: 'Recycle bin', a: 'Deleted records go to Recycle Bin (admins and managers). Restore or permanently remove items from there.' },
    ],
  },
  {
    title: 'Accessibility',
    items: [
      { q: 'Text size', a: 'Open Accessibility in the bottom utility bar and use − / + to adjust text size across six levels.' },
      { q: 'High contrast', a: 'Enable High contrast in the same panel for stronger text and borders.' },
    ],
  },
];

const QUICK_LINKS = [
  { href: '/dashboard', label: 'Home' },
  { href: '/work-items', label: 'Work Items' },
  { href: '/leads', label: 'Leads' },
  { href: '/calendar', label: 'Calendar' },
  { href: '/reports', label: 'Reports' },
  { href: '/settings', label: 'Settings' },
];

export default function HelpPage() {
  return (
    <CRMLayout>
      <div className="p-6 max-w-3xl">
        <div className="page-header mb-6">
          <div>
            <h1 className="page-title">Help &amp; Documentation</h1>
            <p className="page-subtitle">Guides for using your Sales CRM workspace.</p>
          </div>
        </div>

        <div className="card p-5 mb-6">
          <h2 className="text-sm font-semibold text-zoho-text mb-3">Quick links</h2>
          <div className="flex flex-wrap gap-2">
            {QUICK_LINKS.map((link) => (
              <Link key={link.href} href={link.href} className="btn-secondary-sm">
                {link.label}
              </Link>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          {SECTIONS.map((section) => (
            <section key={section.title} className="card p-5">
              <h2 className="text-sm font-semibold text-brand-600 mb-4">{section.title}</h2>
              <dl className="space-y-4">
                {section.items.map((item) => (
                  <div key={item.q}>
                    <dt className="text-sm font-medium text-zoho-text">{item.q}</dt>
                    <dd className="text-sm text-zoho-muted mt-1 leading-relaxed">{item.a}</dd>
                  </div>
                ))}
              </dl>
            </section>
          ))}
        </div>

        <div className="card p-5 mt-6 text-sm text-zoho-muted">
          <p className="font-medium text-zoho-text mb-1">Need more help?</p>
          <p>Contact your CRM administrator or sales manager for account access, role changes, or reporting setup.</p>
        </div>
      </div>
    </CRMLayout>
  );
}
