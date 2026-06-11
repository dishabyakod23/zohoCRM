'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { MODULE_TABS } from '../../lib/constants.js';

export default function ModuleTabs() {
  const pathname = usePathname();
  if (pathname === '/login') return null;

  const isActive = (tab) => tab.match.some(m => pathname === m || pathname.startsWith(m + '/'));

  return (
    <nav className="zoho-module-tabs">
      {MODULE_TABS.map(tab => (
        <Link key={tab.href} href={tab.href}
          className={`zoho-module-tab ${isActive(tab) ? 'zoho-module-tab-active' : 'zoho-module-tab-inactive'}`}>
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
