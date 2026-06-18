'use client';
import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '../../hooks/useAuth.js';
import * as leadsApi from '../../lib/services/leads.js';
import * as contactsApi from '../../lib/services/contacts.js';
import * as accountsApi from '../../lib/services/accounts.js';
import { useToast } from '../ui/Toast.js';
import ConfirmDialog from '../ui/ConfirmDialog.js';
import { getApiError } from '../../lib/api.js';
import { usePermissions } from '../../hooks/usePermissions.js';
import { QUICK_CREATE } from '../../lib/constants.js';
import { userDisplayName, userInitial } from '../../lib/userHelpers.js';

export default function Header({ onMenuClick }) {
  const { user, logout } = useAuth();
  const { showToast } = useToast();
  const { canQuickCreate } = usePermissions();
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [results, setResults] = useState([]);
  const [showResults, setShowResults] = useState(false);
  const [showQuick, setShowQuick] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showNotif, setShowNotif] = useState(false);
  const [logoutConfirm, setLogoutConfirm] = useState(false);
  const searchRef = useRef(null);
  const quickRef = useRef(null);
  const notifRef = useRef(null);
  const profileRef = useRef(null);

  useEffect(() => {
    const onClickOutside = (e) => {
      if (searchRef.current && !searchRef.current.contains(e.target)) setShowResults(false);
      if (quickRef.current && !quickRef.current.contains(e.target)) setShowQuick(false);
      if (notifRef.current && !notifRef.current.contains(e.target)) setShowNotif(false);
      if (profileRef.current && !profileRef.current.contains(e.target)) setShowProfile(false);
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  useEffect(() => {
    if (search.length < 2) { setResults([]); return; }
    const t = setTimeout(() => {
      Promise.all([
        leadsApi.listLeads({ search, page_size: 4 }),
        contactsApi.listContacts({ search, page_size: 4 }),
        accountsApi.listAccounts({ search, page_size: 4 }),
      ]).then(([leads, contacts, accounts]) => {
        setResults([
          ...leads.data.map(l => ({ type: 'lead', id: l.id, name: `${l.first_name || ''} ${l.last_name}`.trim(), sub: l.company })),
          ...contacts.data.map(c => ({ type: 'contact', id: c.id, name: `${c.first_name || ''} ${c.last_name}`.trim(), sub: c.account_name })),
          ...accounts.data.map(a => ({ type: 'account', id: a.id, name: a.name, sub: a.industry })),
        ].slice(0, 12));
      }).catch((err) => {
        setResults([]);
        showToast(getApiError(err));
      });
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  const typeRoute = { lead: 'leads', contact: 'contacts', account: 'accounts' };

  const handleResultClick = (r) => {
    setShowResults(false);
    setSearch('');
    router.push(`/${typeRoute[r.type] || r.type + 's'}/${r.id}`);
  };

  const groups = [...new Set(QUICK_CREATE.map(q => q.group))];

  return (
    <>
      <header className="h-14 bg-white border-b border-zoho-border flex items-center gap-3 px-4 sticky top-0 z-30">
        <button type="button" onClick={onMenuClick} aria-label="Open navigation menu"
          className="md:hidden w-9 h-9 rounded-xl flex items-center justify-center text-zoho-muted hover:bg-brand-50 hover:text-brand-600">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
        </button>

        {/* Search */}
        <div className="relative flex-1 max-w-xl" ref={searchRef}>
          <input
            className="w-full py-2 pl-9 pr-3 text-sm border border-zoho-border rounded-xl bg-brand-50/40 focus:outline-none focus:ring-4 focus:ring-brand-100 focus:border-brand-400 focus:bg-white transition-all duration-150"
            placeholder="Search records, modules..."
            aria-label="Search records and modules"
            value={search}
            onChange={e => { setSearch(e.target.value); setShowResults(true); }}
            onFocus={() => setShowResults(true)}
          />
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zoho-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          {showResults && results.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-zoho-border rounded-xl shadow-card-hover max-h-72 overflow-y-auto z-50 animate-scaleIn origin-top">
              <p className="px-3 py-1.5 text-[10px] font-bold text-brand-600 uppercase tracking-wide">Search Results</p>
              {results.map((r, i) => (
                <button key={i} onClick={() => handleResultClick(r)}
                  className="w-full text-left px-3 py-2 hover:bg-brand-50 text-sm flex justify-between border-t border-gray-50 transition-colors">
                  <span className="font-medium">{r.name}</span>
                  <span className="text-xs text-zoho-muted capitalize">{r.type}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {canQuickCreate && (
        <div className="relative" ref={quickRef}>
          <button onClick={() => setShowQuick(!showQuick)} aria-label="Quick create" aria-expanded={showQuick}
            className="w-9 h-9 rounded-xl bg-brand-500 text-white font-bold text-lg leading-none shadow-soft hover:bg-brand-600 transition-all duration-150" title="Quick Create">+</button>
          {showQuick && (
            <div className="absolute right-0 top-full mt-2 bg-white border border-zoho-border rounded-xl shadow-card-hover py-2 w-52 z-50 animate-scaleIn origin-top-right">
              <p className="px-3 py-1 text-[10px] font-bold text-brand-600 uppercase tracking-wide">Quick Create</p>
              {groups.map(g => (
                <div key={g}>
                  <p className="px-3 py-1 text-[10px] text-zoho-muted">{g}</p>
                  {QUICK_CREATE.filter(q => q.group === g).map(q => (
                    <Link key={q.label} href={q.href} onClick={() => setShowQuick(false)}
                      className="block px-3 py-1.5 text-sm hover:bg-brand-50 hover:text-brand-600 text-zoho-text transition-colors rounded-lg mx-1">+ {q.label}</Link>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
        )}

        {/* Right: notifications, settings, profile */}
        <div className="flex items-center gap-1 ml-auto">
          <div className="relative" ref={notifRef}>
            <button onClick={() => setShowNotif(!showNotif)} aria-label="Notifications" aria-expanded={showNotif}
              className="w-9 h-9 rounded-xl flex items-center justify-center text-zoho-muted hover:text-brand-600 hover:bg-brand-50 transition-colors" title="Notifications">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
            </button>
            {showNotif && (
              <div className="absolute right-0 top-full mt-2 bg-white border border-zoho-border rounded-xl shadow-card-hover w-64 py-2 z-50 animate-scaleIn origin-top-right">
                <p className="px-3 py-2 text-sm text-zoho-muted">No new notifications</p>
              </div>
            )}
          </div>

          <Link href="/settings" className="w-9 h-9 rounded-xl flex items-center justify-center text-zoho-muted hover:text-brand-600 hover:bg-brand-50 transition-colors" title="Settings">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
          </Link>

          <div className="relative" ref={profileRef}>
            <button onClick={() => setShowProfile(!showProfile)} aria-label="User profile menu" aria-expanded={showProfile}
              className="w-9 h-9 rounded-xl bg-brand-500 text-white text-xs font-bold hover:bg-brand-600 transition-colors">
              {userInitial(user)}
            </button>
            {showProfile && (
              <div className="absolute right-0 top-full mt-2 bg-white border border-zoho-border rounded-xl shadow-card-hover py-1 w-48 z-50 animate-scaleIn origin-top-right">
                <div className="px-3 py-2.5 border-b border-gray-100">
                  <p className="text-sm font-semibold text-zoho-text">{userDisplayName(user)}</p>
                  <p className="text-xs text-zoho-muted">{user?.email}</p>
                  <p className="text-[10px] text-brand-600 capitalize mt-0.5 font-medium">{user?.role?.replace('_', ' ')}</p>
                </div>
                <Link href="/settings" onClick={() => setShowProfile(false)} className="block px-3 py-2 text-sm hover:bg-brand-50 hover:text-brand-600 transition-colors">View Profile</Link>
                <button onClick={() => { setShowProfile(false); setLogoutConfirm(true); }}
                  className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors">Sign Out</button>
              </div>
            )}
          </div>
        </div>

      </header>

      <ConfirmDialog open={logoutConfirm} message="Are you sure you want to log out?" confirmLabel="Log Out" cancelLabel="Stay"
        onConfirm={() => { setLogoutConfirm(false); logout(); }} onCancel={() => setLogoutConfirm(false)} />
    </>
  );
}
