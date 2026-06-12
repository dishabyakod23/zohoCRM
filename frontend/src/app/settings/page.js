'use client';
import Link from 'next/link';
import CRMLayout from '../../components/layout/CRMLayout.js';
import { useAuth } from '../../hooks/useAuth.js';
import { userDisplayName } from '../../lib/userHelpers.js';

const SETUP_CATEGORIES = [
  {
    title: 'General',
    items: [
      { label: 'Personal Settings', desc: 'Profile, timezone, locale' },
      { label: 'Users', desc: 'Manage users and roles' },
      { label: 'Company Settings', desc: 'Organization details' },
    ],
  },
  {
    title: 'Customization',
    items: [
      { label: 'Modules and Fields', desc: 'Customize modules, fields, layouts' },
      { label: 'Home Page', desc: 'Customize home page components' },
      { label: 'Templates', desc: 'Email and inventory templates' },
    ],
  },
  {
    title: 'Automation',
    items: [
      { label: 'Workflow Rules', desc: 'Automate business processes' },
      { label: 'Scheduled Reports', desc: 'Weekly auto-reports configuration' },
    ],
  },
  {
    title: 'Data Administration',
    items: [
      { label: 'Import', desc: 'Bulk import records' },
      { label: 'Export', desc: 'Export data to CSV' },
      { label: 'Recycle Bin', desc: 'Restore or delete records', href: '/recycle-bin' },
    ],
  },
];

export default function SettingsPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'super_admin' || user?.role === 'admin';

  return (
    <CRMLayout>
      <div className="p-6">
        <h1 className="text-lg font-semibold text-zoho-text mb-1">Setup</h1>
        <p className="text-sm text-zoho-muted mb-6">Configure your CRM and manage system preferences</p>

        <div className="card p-5 mb-6">
          <h2 className="text-sm font-semibold mb-3">My Profile</h2>
          <dl className="grid grid-cols-3 gap-4 text-sm">
            <div><dt className="text-zoho-muted text-xs">Name</dt><dd className="font-medium">{userDisplayName(user)}</dd></div>
            <div><dt className="text-zoho-muted text-xs">Email</dt><dd>{user?.email}</dd></div>
            <div><dt className="text-zoho-muted text-xs">Role</dt><dd className="capitalize text-brand-600">{user?.role?.replace('_', ' ')}</dd></div>
          </dl>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {SETUP_CATEGORIES.map(cat => (
            <div key={cat.title} className="card p-5">
              <h2 className="text-xs font-bold text-zoho-muted uppercase tracking-wide mb-3">{cat.title}</h2>
              <div className="space-y-2">
                {cat.items.map(item => (
                  item.href ? (
                    <Link key={item.label} href={item.href} className="block p-3 rounded hover:bg-brand-50 border border-transparent hover:border-brand-100 transition-colors">
                      <p className="text-sm font-medium text-brand-600">{item.label}</p>
                      <p className="text-xs text-zoho-muted">{item.desc}</p>
                    </Link>
                  ) : (
                    <div key={item.label} className="p-3 rounded hover:bg-gray-50 cursor-default">
                      <p className="text-sm font-medium text-zoho-text">{item.label}</p>
                      <p className="text-xs text-zoho-muted">{item.desc}</p>
                    </div>
                  )
                ))}
              </div>
            </div>
          ))}
        </div>

        {isAdmin && (
          <div className="card p-5 mt-6">
            <h2 className="text-sm font-semibold mb-2">Weekly Auto-Reports</h2>
            <p className="text-sm text-zoho-muted mb-3">Sent every Monday 8:00 AM IST to Super Admins and Sales Managers.</p>
            <button className="btn-secondary text-xs" onClick={() => fetch('/api/reports/weekly/trigger', { method: 'POST', headers: { Authorization: `Bearer ${localStorage.getItem('crm_token')}` } })}>
              Trigger report now
            </button>
          </div>
        )}
      </div>
    </CRMLayout>
  );
}
