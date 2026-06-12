'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import CRMLayout from '../../../components/layout/CRMLayout.js';

export default function AccountDetailPage() {
  const router = useRouter();

  useEffect(() => {
    router.push('/accounts');
  }, [router]);

  return (
    <CRMLayout>
      <div className="p-6 text-gray-500">Redirecting to accounts...</div>
    </CRMLayout>
  );
}
