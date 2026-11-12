'use client';
import { useState, useRef, useEffect } from 'react';
import AppLink from '../ui/AppLink.js';
import { navigateToRecord } from '../../lib/recordNavigation.js';
import { useAuth } from '../../hooks/useAuth.js';
import { useMeetingReminders } from '../../hooks/useMeetingReminders.js';
import { useToast } from '../ui/Toast.js';
import ConfirmDialog from '../ui/ConfirmDialog.js';
import { usePermissions } from '../../hooks/usePermissions.js';
import { QUICK_CREATE } from '../../lib/constants.js';
import { userDisplayName } from '../../lib/userHelpers.js';
import UserAvatar from '../users/UserAvatar.js';
import { runGlobalSearch, matchPagesAndActions, visibleSearchSources } from '../../lib/globalSearch.js';

function formatNotifWhen(iso) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}

export default function Header({ onMenuClick }) {
  const { user, logout } = useAuth();
  const { showToast, clearToasts } = useToast();
  const { canQuickCreate, can } = usePermissions();
  const {
    reminders: meetingReminders,
    count: meetingNotifCount,
    loading: meetingNotifLoading,
    refresh: refreshMeetingReminders,
    acknowledge: acknowledgeMeeting,
    openPopup: openMeetingInvitePopup,
  } = useMeetingReminders();
  const [search, setSearch] = useState('');
  const [searchGroups, setSearchGroups] = useState([]);
  const [searchPending, setSearchPending] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [showResults, setShowResults] = useState(false);
  const [showQuick, setShowQuick] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showNotif, setShowNotif] = useState(false);
  const [ackingId, setAckingId] = useState(null);
  const [logoutConfirm, setLogoutConfirm] = useState(false);
  const searchRef = useRef(null);
  const searchRequestRef = useRef(null);
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

  // Global search: pages/actions match instantly; each record type's results appear as it answers.
  useEffect(() => {
    const query = search.trim();
    setActiveIndex(-1);
    if (query.length < 2) {
      setSearchGroups([]);
      setSearchPending(false);
      return undefined;
    }
    const pages = matchPagesAndActions(query, can);
    setSearchGroups(pages.length ? [{ key: 'pages', label: 'Pages & Actions', results: pages }] : []);
    setSearchPending(true);
    const latestRequest = {};
    searchRequestRef.current = latestRequest;
    const isCurrent = () => searchRequestRef.current === latestRequest;
    const order = visibleSearchSources(can).map((s) => s.key);
    const t = setTimeout(() => {
      runGlobalSearch(query, {
        can,
        onGroup: (key, label, groupResults) => {
          if (!isCurrent() || !groupResults.length) return;
          setSearchGroups((prev) => [...prev.filter((g) => g.key !== key), { key, label, results: groupResults }]
            .sort((a, b) => (a.key === 'pages' ? -1 : b.key === 'pages' ? 1 : order.indexOf(a.key) - order.indexOf(b.key))));
        },
      }).finally(() => { if (isCurrent()) setSearchPending(false); });
    }, 350);
    return () => {
      searchRequestRef.current = null;
      clearTimeout(t);
    };
  }, [search, can]);

  const flatResults = searchGroups.flatMap((g) => g.results);

  const handleResultClick = (r) => {
    setShowResults(false);
    setSearch('');
    navigateToRecord(r.href);
  };

  const handleSearchKeyDown = (e) => {
    if (e.key === 'Escape') {
      setShowResults(false);
      e.currentTarget.blur();
      return;
    }
    if (!flatResults.length) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setShowResults(true);
      setActiveIndex((i) => (i + 1) % flatResults.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => (i <= 0 ? flatResults.length - 1 : i - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      handleResultClick(flatResults[Math.max(activeIndex, 0)]);
    }
  };

  const groups = [...new Set(QUICK_CREATE.filter((q) => can(q.permissionKey, 'create')).map(q => q.group))];

  const toggleNotif = () => {
    const next = !showNotif;
    setShowNotif(next);
    if (next) refreshMeetingReminders({ quiet: true });
  };

  const handleAckMeeting = async (id, e) => {
    e?.stopPropagation?.();
    e?.preventDefault?.();
    setAckingId(id);
    try {
      await acknowledgeMeeting(id);
    } catch {
      // toasted in hook
    } finally {
      setAckingId(null);
    }
  };

  const handleOpenMeeting = async (reminder) => {
    setShowNotif(false);
    try {
      await acknowledgeMeeting(reminder.id);
    } catch {
      // still navigate
    }
    navigateToRecord(`/meetings/${reminder.id}`);
  };

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
            placeholder="Search contacts, leads, accounts, deals, campaigns, pages…"
            aria-label="Search everything in the CRM"
            role="combobox"
            aria-expanded={showResults && search.trim().length >= 2}
            aria-controls="global-search-results"
            value={search}
            onChange={e => { setSearch(e.target.value); setShowResults(true); }}
            onFocus={() => setShowResults(true)}
            onKeyDown={handleSearchKeyDown}
          />
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zoho-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          {showResults && search.trim().length >= 2 && (
            <div id="global-search-results" role="listbox" className="absolute top-full left-0 right-0 mt-2 bg-white border border-zoho-border rounded-xl shadow-card-hover max-h-[28rem] overflow-y-auto z-50 animate-scaleIn origin-top">
              {(() => {
                let index = -1;
                return searchGroups.map((group) => (
                  <div key={group.key} className="py-1 border-t border-gray-50 first:border-t-0">
                    <p className="px-3 pt-1.5 pb-1 text-[10px] font-bold text-brand-600 uppercase tracking-wide">{group.label}</p>
                    {group.results.map((r) => {
                      index += 1;
                      const i = index;
                      return (
                        <button
                          key={`${group.key}:${r.id}`}
                          type="button"
                          role="option"
                          aria-selected={i === activeIndex}
                          onMouseEnter={() => setActiveIndex(i)}
                          onClick={() => handleResultClick(r)}
                          className={`w-full text-left px-3 py-2 text-sm flex justify-between gap-3 transition-colors ${i === activeIndex ? 'bg-brand-50' : 'hover:bg-brand-50'}`}
                        >
                          <span className="min-w-0">
                            <span className="font-medium block truncate">{r.name}</span>
                            {r.sub ? <span className="text-xs text-zoho-muted block truncate">{r.sub}</span> : null}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                ));
              })()}
              {searchPending && (
                <p className="px-3 py-2 text-xs text-zoho-muted border-t border-gray-50">Searching…</p>
              )}
              {!searchPending && searchGroups.length === 0 && (
                <p className="px-3 py-3 text-sm text-zoho-muted">{`No matches for “${search.trim()}”`}</p>
              )}
            </div>
          )}
        </div>

        {canQuickCreate && groups.length > 0 && (
        <div className="relative" ref={quickRef}>
          <button onClick={() => setShowQuick(!showQuick)} aria-label="Quick create" aria-expanded={showQuick}
            className="w-9 h-9 rounded-xl bg-brand-500 text-white font-bold text-lg leading-none shadow-soft hover:bg-brand-600 transition-all duration-150" title="Quick Create">+</button>
          {showQuick && (
            <div className="absolute right-0 top-full mt-2 bg-white border border-zoho-border rounded-xl shadow-card-hover py-2 w-52 z-50 animate-scaleIn origin-top-right">
              <p className="px-3 py-1 text-[10px] font-bold text-brand-600 uppercase tracking-wide">Quick Create</p>
              {groups.map(g => (
                <div key={g}>
                  <p className="px-3 py-1 text-[10px] text-zoho-muted">{g}</p>
                  {QUICK_CREATE.filter(q => q.group === g && can(q.permissionKey, 'create')).map(q => (
                    <button
                      key={q.label}
                      type="button"
                      onClick={() => {
                        setShowQuick(false);
                        navigateToRecord(q.href);
                      }}
                      className="block w-full text-left px-3 py-1.5 text-sm hover:bg-brand-50 hover:text-brand-600 text-zoho-text transition-colors rounded-lg mx-1"
                    >
                      + {q.label}
                    </button>
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
            <button onClick={toggleNotif} aria-label="Notifications" aria-expanded={showNotif}
              className="relative w-9 h-9 rounded-xl flex items-center justify-center text-zoho-muted hover:text-brand-600 hover:bg-brand-50 transition-colors" title="Notifications">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
              {meetingNotifCount > 0 && (
                <span className="absolute top-1 right-1 min-w-[1rem] h-4 px-1 bg-accent-pink text-white text-[9px] rounded-full flex items-center justify-center font-bold ring-2 ring-white">
                  {meetingNotifCount > 9 ? '9+' : meetingNotifCount}
                </span>
              )}
            </button>
            {showNotif && (
              <div className="absolute right-0 top-full mt-2 bg-white border border-zoho-border rounded-xl shadow-card-hover w-80 max-h-96 overflow-hidden z-50 animate-scaleIn origin-top-right flex flex-col">
                <div className="px-3 py-2 border-b border-zoho-border flex items-center justify-between gap-2">
                  <p className="text-[10px] font-bold text-brand-600 uppercase tracking-wide">Notifications</p>
                  {meetingNotifCount > 0 && (
                    <button
                      type="button"
                      onClick={() => { setShowNotif(false); openMeetingInvitePopup(); }}
                      className="text-[11px] text-brand-600 hover:underline"
                    >
                      Open invite
                    </button>
                  )}
                </div>
                <div className="overflow-y-auto flex-1">
                  {meetingNotifLoading && meetingReminders.length === 0 ? (
                    <p className="px-3 py-4 text-sm text-zoho-muted">Loading…</p>
                  ) : meetingReminders.length === 0 ? (
                    <p className="px-3 py-4 text-sm text-zoho-muted">No new meeting invites</p>
                  ) : (
                    meetingReminders.map((n) => (
                      <div key={n.id} className="px-3 py-2.5 border-t border-gray-50 hover:bg-brand-50/50 transition-colors">
                        <button
                          type="button"
                          onClick={() => handleOpenMeeting(n)}
                          className="w-full text-left"
                        >
                          <p className="text-sm font-medium text-zoho-text line-clamp-1">{n.title}</p>
                          <p className="text-xs text-zoho-muted mt-0.5 line-clamp-2">{n.message}</p>
                          <p className="text-[10px] text-zoho-muted mt-1">
                            {formatNotifWhen(n.start_at)}
                            {n.host_name ? ` · ${n.host_name}` : ''}
                          </p>
                        </button>
                        <div className="flex items-center gap-3 mt-2">
                          <button
                            type="button"
                            disabled={ackingId === n.id}
                            onClick={(e) => handleAckMeeting(n.id, e)}
                            className="text-[11px] font-medium text-zoho-muted hover:text-zoho-text disabled:opacity-50"
                          >
                            {ackingId === n.id ? 'Dismissing…' : 'Dismiss'}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenMeeting(n)}
                            className="text-[11px] font-medium text-brand-600 hover:underline"
                          >
                            View
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          <AppLink href="/settings" className="w-9 h-9 rounded-xl flex items-center justify-center text-zoho-muted hover:text-brand-600 hover:bg-brand-50 transition-colors" title="Settings">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
          </AppLink>

          <div className="relative" ref={profileRef}>
            <button onClick={() => setShowProfile(!showProfile)} aria-label="User profile menu" aria-expanded={showProfile}
              className="rounded-xl hover:opacity-90 transition-opacity">
              <UserAvatar user={user} size="md" />
            </button>
            {showProfile && (
              <div className="absolute right-0 top-full mt-2 bg-white border border-zoho-border rounded-xl shadow-card-hover py-1 w-56 z-50 animate-scaleIn origin-top-right">
                <div className="px-3 py-2.5 border-b border-gray-100 flex items-center gap-3">
                  <UserAvatar user={user} size="md" />
                  <div className="min-w-0">
                  <p className="text-sm font-semibold text-zoho-text">{userDisplayName(user)}</p>
                  <p className="text-xs text-zoho-muted">{user?.email}</p>
                  <p className="text-[10px] text-brand-600 capitalize mt-0.5 font-medium">{user?.role?.replace('_', ' ')}</p>
                  </div>
                </div>
                <AppLink href="/settings" onClick={() => setShowProfile(false)} className="block px-3 py-2 text-sm hover:bg-brand-50 hover:text-brand-600 transition-colors">View Profile</AppLink>
                <button onClick={() => { setShowProfile(false); setLogoutConfirm(true); }}
                  className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors">Sign Out</button>
              </div>
            )}
          </div>
        </div>

      </header>

      <ConfirmDialog open={logoutConfirm} message="Are you sure you want to log out?" confirmLabel="Log Out" cancelLabel="Stay"
        onConfirm={() => { setLogoutConfirm(false); clearToasts?.(); logout(); }} onCancel={() => setLogoutConfirm(false)} />
    </>
  );
}
