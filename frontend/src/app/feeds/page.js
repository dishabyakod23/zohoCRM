'use client';
import CRMLayout from '../../components/layout/CRMLayout.js';
import { useAuth } from '../../hooks/useAuth.js';

export default function FeedsPage() {
  const { user } = useAuth();
  const feeds = [
    { user: 'Disha Rao', action: 'closed deal', record: 'Byju\'s Platform Deal', time: '2 hours ago' },
    { user: 'Sales Manager', action: 'created lead', record: 'Rohit Sharma - Zepto', time: '5 hours ago' },
    { user: user?.name || 'You', action: 'completed task', record: 'Follow up with TCS', time: '1 day ago' },
    { user: 'Sales Rep', action: 'logged call', record: 'Discovery call - Zepto', time: '1 day ago' },
  ];

  return (
    <CRMLayout>
      <div className="p-6 max-w-3xl">
        <h1 className="text-lg font-semibold mb-4">Feeds</h1>
        <p className="text-sm text-zoho-muted mb-6">Stay updated on your team's CRM activity — like Zoho CRM Feeds.</p>
        <div className="space-y-3">
          {feeds.map((f, i) => (
            <div key={i} className="card p-4 flex gap-3">
              <div className="w-9 h-9 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center text-sm font-semibold shrink-0">{f.user[0]}</div>
              <div>
                <p className="text-sm"><span className="font-medium">{f.user}</span> {f.action} <span className="text-brand-600 font-medium">{f.record}</span></p>
                <p className="text-xs text-zoho-muted mt-1">{f.time}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </CRMLayout>
  );
}
