'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import CRMLayout from '../../../components/layout/CRMLayout.js';
import Badge from '../../../components/ui/Badge.js';
import ConfirmDialog from '../../../components/ui/ConfirmDialog.js';
import RecordDetailLayout, { InfoRow, FieldSection } from '../../../components/records/RecordDetailLayout.js';
import { useToast } from '../../../components/ui/Toast.js';
import { getApiError } from '../../../lib/api.js';
import { trackRecentItem } from '../../../components/layout/BottomUtilityBar.js';
import * as leadsApi from '../../../lib/services/leads.js';
import {
  EnvelopeIcon, PhoneIcon, DevicePhoneMobileIcon, BuildingOffice2Icon, TagIcon, TrashIcon,
} from '@heroicons/react/24/outline';

export default function LeadDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const { showToast } = useToast();
  const [lead, setLead] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  useEffect(() => {
    leadsApi.getLead(id).then(r => {
      setLead(r);
      trackRecentItem({ type: 'lead', id, name: `${r.first_name} ${r.last_name}` });
    }).catch(() => router.push('/leads'));
  }, [id, router]);

  if (!lead) return <CRMLayout><div className="p-6">Loading...</div></CRMLayout>;

  const leadInfoFields = [
    ['Lead Owner', lead.owner_name],
    ['Lead Source', lead.source],
    ['Industry', lead.industry],
    ['Title', lead.title],
    ['Rating', lead.rating],
    ['Annual Revenue', lead.annual_revenue],
  ];
  const contactFields = [
    ['Email', lead.email], ['Phone', lead.phone], ['Mobile', lead.mobile], ['Website', lead.website],
  ];
  const addressFields = [
    ['Street', lead.street], ['City', lead.city], ['State', lead.state], ['Country', lead.country], ['Zip', lead.zip_code],
  ];

  return (
    <CRMLayout>
      <RecordDetailLayout
        backHref="/leads" backLabel="Leads"
        title={`${lead.first_name} ${lead.last_name}`}
        subtitle={lead.company}
        badges={<Badge label={lead.status} />}
        lastUpdated={new Date(lead.updated_at).toLocaleString()}
        tabs={['Overview', 'Timeline', 'Notes']}
        actions={
          <button onClick={() => setDeleteConfirm(true)} className="btn-danger text-xs flex items-center gap-1.5">
            <TrashIcon className="w-4 h-4" /> Delete
          </button>
        }
        sidebar={
          <div className="card p-4">
            <h3 className="zoho-widget-title">Contact Details</h3>
            <div className="divide-y divide-gray-50">
              <InfoRow icon={<EnvelopeIcon className="w-4 h-4" />} label="Email" value={lead.email} href={lead.email && `mailto:${lead.email}`} />
              <InfoRow icon={<PhoneIcon className="w-4 h-4" />} label="Phone" value={lead.phone} href={lead.phone && `tel:${lead.phone}`} />
              <InfoRow icon={<DevicePhoneMobileIcon className="w-4 h-4" />} label="Mobile" value={lead.mobile} href={lead.mobile && `tel:${lead.mobile}`} />
              <InfoRow icon={<BuildingOffice2Icon className="w-4 h-4" />} label="Company" value={lead.company} />
              <InfoRow icon={<TagIcon className="w-4 h-4" />} label="Lead Source" value={lead.source} />
            </div>
          </div>
        }
        tabContent={(tab) => {
          if (tab === 'Overview') return (
            <div className="space-y-4">
              <FieldSection title="Lead Information" fields={leadInfoFields} />
              <FieldSection title="Contact Information" fields={contactFields} />
              <FieldSection title="Address Information" fields={addressFields} />
              {lead.description && (
                <div className="card p-5">
                  <h3 className="text-xs font-bold text-brand-700/80 uppercase tracking-wide mb-2">Description</h3>
                  <p className="text-sm text-zoho-text">{lead.description}</p>
                </div>
              )}
              {lead.is_converted && (
                <div className="card p-4 bg-green-50 border border-green-200 text-sm text-green-800">
                  This lead was converted{lead.converted_at ? ` on ${new Date(lead.converted_at).toLocaleString()}` : ''}.
                </div>
              )}
            </div>
          );
          return (
            <div className="card p-8 text-center text-zoho-muted text-sm">
              {tab} is not available on the Sales CRM API yet.
            </div>
          );
        }}
      />

      <ConfirmDialog
        open={deleteConfirm}
        message={`Are you sure you want to delete ${lead.first_name} ${lead.last_name}?`}
        confirmLabel="Confirm Delete"
        danger
        onConfirm={async () => {
          try {
            await leadsApi.deleteLead(id);
            router.push('/leads');
          } catch (err) {
            showToast(getApiError(err));
          }
        }}
        onCancel={() => setDeleteConfirm(false)}
      />
    </CRMLayout>
  );
}
