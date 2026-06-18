'use client';
import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '../../hooks/useAuth.js';
import Sidebar from './Sidebar';
import Header from './Header';
import BottomUtilityBar from './BottomUtilityBar';
import LoginReminderModal from '../calendar/LoginReminderModal.js';
import * as calendarApi from '../../lib/services/calendar.js';
import { todayKey } from '../../lib/calendarHelpers.js';

function dismissKey(userId) {
  return `crm_reminders_dismissed_${userId}_${todayKey()}`;
}

export default function CRMLayout({ children }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [loginReminders, setLoginReminders] = useState([]);
  const [showLoginReminders, setShowLoginReminders] = useState(false);

  useEffect(() => {
    if (!loading && !user) router.push('/login');
  }, [user, loading, router]);

  useEffect(() => {
    setMobileNavOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!user?.id || pathname === '/login') return;

    const pendingLogin = sessionStorage.getItem('crm_show_login_reminders') === '1';
    const dismissed = localStorage.getItem(dismissKey(user.id)) === '1';
    if (!pendingLogin && dismissed) return;

    calendarApi.getLoginReminders()
      .then((items) => {
        if (items.length > 0) {
          setLoginReminders(items);
          setShowLoginReminders(true);
        }
        sessionStorage.removeItem('crm_show_login_reminders');
      })
      .catch(() => {
        sessionStorage.removeItem('crm_show_login_reminders');
      });
  }, [user?.id, pathname]);

  const dismissLoginReminders = () => {
    if (user?.id) localStorage.setItem(dismissKey(user.id), '1');
    setShowLoginReminders(false);
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-white">
      <div className="w-10 h-10 border-[3px] border-brand-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );
  if (!user) return null;

  return (
    <div className="flex h-screen">
      {mobileNavOpen && (
        <button
          type="button"
          aria-label="Close navigation menu"
          className="fixed inset-0 bg-black/40 z-30 md:hidden"
          onClick={() => setMobileNavOpen(false)}
        />
      )}
      <Sidebar mobileOpen={mobileNavOpen} onNavigate={() => setMobileNavOpen(false)} />
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <Header onMenuClick={() => setMobileNavOpen(true)} />
        <main className="flex-1 overflow-auto pb-0">{children}</main>
        <BottomUtilityBar />
      </div>

      <LoginReminderModal
        open={showLoginReminders}
        events={loginReminders}
        onClose={dismissLoginReminders}
        onDismissToday={dismissLoginReminders}
      />
    </div>
  );
}
