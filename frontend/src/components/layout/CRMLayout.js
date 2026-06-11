'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../hooks/useAuth.js';
import Sidebar from './Sidebar';
import Header from './Header';
import ModuleTabs from './ModuleTabs';
import BottomUtilityBar from './BottomUtilityBar';

export default function CRMLayout({ children }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) router.push('/login');
  }, [user, loading, router]);

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-mesh-bg bg-[#f6f6fc]">
      <div className="w-10 h-10 border-[3px] border-brand-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );
  if (!user) return null;

  return (
    <div className="flex h-screen">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <Header />
        <ModuleTabs />
        <main className="flex-1 overflow-auto pb-0">{children}</main>
        <BottomUtilityBar />
      </div>
    </div>
  );
}
