'use client';
import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '../../hooks/useAuth.js';
import Sidebar from './Sidebar';
import Header from './Header';
import BottomUtilityBar from './BottomUtilityBar';
import { JustCallProvider } from '../justcall/JustCallProvider.js';

export default function CRMLayout({ children }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => {
    if (!loading && !user) router.push('/login');
  }, [user, loading, router]);

  useEffect(() => {
    setMobileNavOpen(false);
  }, [pathname]);

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-white">
      <div className="w-10 h-10 border-[3px] border-brand-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );
  if (!user) return null;

  return (
    <JustCallProvider>
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
    </div>
    </JustCallProvider>
  );
}
