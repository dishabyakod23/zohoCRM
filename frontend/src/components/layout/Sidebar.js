'use client';
import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { NAV_MODULES, MODULE_ICONS } from '../../lib/constants.js';

export default function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [moduleSearch, setModuleSearch] = useState('');

  const mainNav = NAV_MODULES.filter(n => n.section === 'main');
  const modules = NAV_MODULES.filter(n => n.section === 'modules' && !n.parent &&
    n.label.toLowerCase().includes(moduleSearch.toLowerCase()));

  const isActive = (href) => pathname === href || pathname.startsWith(href + '/');

  return (
    <aside className={`${collapsed ? 'w-16' : 'w-60'} bg-sidebar-gradient flex flex-col h-screen sticky top-0 shrink-0 transition-all duration-300 shadow-2xl z-40`}>
      <div className="px-3 py-3.5 flex items-center gap-2.5 border-b border-white/10">
        <div className="w-9 h-9 bg-brand-gradient rounded-xl flex items-center justify-center text-white font-bold text-base shrink-0 shadow-glow">Z</div>
        {!collapsed && (
          <div className="min-w-0">
            <span className="font-bold text-white text-sm block truncate tracking-tight">Zoho CRM</span>
            <span className="text-[10px] text-white/50">CRM Standard</span>
          </div>
        )}
        <button onClick={() => setCollapsed(!collapsed)}
          className="ml-auto w-6 h-6 rounded-lg flex items-center justify-center text-white/50 text-xs hover:text-white hover:bg-white/10 transition-colors">
          {collapsed ? '»' : '«'}
        </button>
      </div>

      <nav className="flex-1 py-3 px-2.5 space-y-0.5 overflow-y-auto overflow-x-hidden">
        {!collapsed && <p className="px-2.5 py-1.5 text-[10px] font-bold text-white/35 uppercase tracking-widest">Workspace</p>}
        {mainNav.map(({ href, label, icon }) => (
          <Link key={href} href={href} title={label}
            className={`zoho-nav-item ${isActive(href) ? 'zoho-nav-active' : 'zoho-nav-inactive'}`}>
            <span className="text-base w-5 text-center shrink-0">{MODULE_ICONS[icon] || '•'}</span>
            {!collapsed && <span className="truncate">{label}</span>}
          </Link>
        ))}

        {!collapsed && (
          <>
            <p className="px-2.5 py-1.5 mt-3 text-[10px] font-bold text-white/35 uppercase tracking-widest">Modules</p>
            <div className="relative mx-1 mb-1.5">
              <input
                className="w-full pl-7 pr-2 py-1.5 text-xs rounded-lg bg-white/10 text-white placeholder:text-white/40 border border-white/10 focus:outline-none focus:ring-2 focus:ring-brand-400/50 focus:bg-white/15 transition-all"
                placeholder="Search modules..." value={moduleSearch}
                onChange={e => setModuleSearch(e.target.value)} />
              <svg className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
          </>
        )}
        {modules.map(({ href, label, icon }) => (
          <Link key={href} href={href} title={label}
            className={`zoho-nav-item ${isActive(href) ? 'zoho-nav-active' : 'zoho-nav-inactive'}`}>
            <span className="text-base w-5 text-center shrink-0">{MODULE_ICONS[icon] || '•'}</span>
            {!collapsed && <span className="truncate">{label}</span>}
          </Link>
        ))}
      </nav>

      {!collapsed && (
        <div className="p-3 border-t border-white/10 text-[10px] text-white/40 text-center">
          <span className="bg-brand-gradient bg-clip-text text-transparent font-semibold">NextGen UI</span>
        </div>
      )}
    </aside>
  );
}
