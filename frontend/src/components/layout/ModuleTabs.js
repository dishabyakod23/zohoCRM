'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { MODULE_TABS } from '../../lib/constants.js';
import { usePermissions } from '../../hooks/usePermissions.js';

export default function ModuleTabs() {
  const pathname = usePathname();
  const { canAccessReports } = usePermissions();
  if (['/login', '/forgot-password', '/reset-password'].includes(pathname)) return null;

  const tabs = MODULE_TABS.filter(t => t.href !== '/reports' || canAccessReports);

  const isActive = (tab) => tab.match.some(m => pathname === m || pathname.startsWith(m + '/'));

  return (
    <nav className="zoho-module-tabs">
      {tabs.map(tab => (
        <Link key={tab.href} href={tab.href}
          className={`zoho-module-tab ${isActive(tab) ? 'zoho-module-tab-active' : 'zoho-module-tab-inactive'}`}>
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
