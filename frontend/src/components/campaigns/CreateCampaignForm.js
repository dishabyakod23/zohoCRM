'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import CRMLayout from '../layout/CRMLayout.js';
import FormField, { inputClass } from '../forms/FormField.js';
import { useAuth } from '../../hooks/useAuth.js';
import { useToast } from '../ui/Toast.js';
import { getApiError } from '../../lib/api.js';
import { validateRequired } from '../../lib/validators.js';
import * as campaignsApi from '../../lib/services/campaigns.js';
import { fetchCampaignTypes, fetchCampaignStatuses, fetchUsers } from '../../lib/services/lookups.js';

export function emptyCampaignForm() {
  return {
    owner_id: '',
    name: '',
    start_date: '',
    expected_revenue: '',
    actual_cost: '',
    numbers_sent: '',
    type: '',
    status: '',
    end_date: '',
    budgeted_cost: '',
    expected_response: '',
    description: '',
  };
}

function SectionTitle({ children }) {
  return (
    <h3 className="text-sm font-semibold text-zoho-text border-b border-zoho-border pb-2 mb-4 mt-8 first:mt-0">
      {children}
    </h3>
  );
}

function RsAmountInput({ value, onChange, error, name }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-xs text-zoho-muted shrink-0 w-8">Rs.</span>
      <input
        className={inputClass(error)}
        type="number"
        min={0}
        step="any"
        name={name}
        value={value}
        onChange={onChange}
      />
    </div>
  );
}

export default function CreateCampaignForm() {
  const router = useRouter();
  const { user } = useAuth();
  const { showToast } = useToast();
  const [form, setForm] = useState(() => ({ ...emptyCampaignForm(), owner_id: user?.id || '' }));
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [users, setUsers] = useState([]);
  const [typeOptions, setTypeOptions] = useState([]);
  const [statusOptions, setStatusOptions] = useState([]);

  useEffect(() => {
    if (user?.id && !form.owner_id) {
      setForm((f) => ({ ...f, owner_id: user.id }));
    }
  }, [user?.id, form.owner_id]);

  useEffect(() => {
    Promise.all([fetchUsers(), fetchCampaignTypes(), fetchCampaignStatuses()])
      .then(([u, t, s]) => {
        setUsers(u);
        setTypeOptions(t);
        setStatusOptions(s);
      })
      .catch(() => {});
  }, []);

  const set = (field) => (e) => {
    setForm((f) => ({ ...f, [field]: e.target.value }));
    setErrors((er) => ({ ...er, [field]: null }));
  };

  const handleSave = async () => {
    const errs = validateRequired(
      {
        name: 'Campaign Name',
        type: 'Type',
        status: 'Status',
        start_date: 'Start Date',
        end_date: 'End Date',
      },
      form,
    );
    setErrors(errs);
    if (Object.keys(errs).length) {
      showToast('Please fill in all required fields before saving.');
      return;
    }
    setSaving(true);
    try {
      const created = await campaignsApi.createCampaign(form);
      showToast('Campaign saved', 'success');
      router.push(created?.id ? `/campaigns/${created.id}` : '/campaigns');
    } catch (err) {
      showToast(getApiError(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <CRMLayout>
      <div className="p-6 max-w-5xl mx-auto w-full">
        <Link href="/campaigns" className="inline-flex items-center gap-1.5 text-xs font-medium text-zoho-muted hover:text-brand-600 transition-colors mb-4">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Campaigns
        </Link>

        <div className="flex items-center justify-between mb-6">
          <h1 className="text-lg font-semibold text-zoho-text">Create Campaign</h1>
          <div className="flex gap-2">
            <Link href="/campaigns" className="btn-secondary">Cancel</Link>
            <button type="button" onClick={handleSave} disabled={saving} className="btn-primary">
              {saving ? 'Saving…' : 'Save Campaign'}
            </button>
          </div>
        </div>

        <div className="card p-6">
          <SectionTitle>Campaign Information</SectionTitle>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
            <FormField label="Campaign Owner" name="owner_id">
              <select className="input" value={form.owner_id} onChange={set('owner_id')}>
                <option value="">—None—</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>
            </FormField>

            <FormField label="Type" required error={errors.type} name="type">
              <select className={inputClass(errors.type)} value={form.type} onChange={set('type')}>
                <option value="">—None—</option>
                {typeOptions.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </FormField>

            <FormField label="Campaign Name" required error={errors.name} name="name">
              <input className={inputClass(errors.name)} value={form.name} onChange={set('name')} />
            </FormField>

            <FormField label="Status" required error={errors.status} name="status">
              <select className={inputClass(errors.status)} value={form.status} onChange={set('status')}>
                <option value="">—None—</option>
                {statusOptions.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </FormField>

            <FormField label="Start Date" required error={errors.start_date} name="start_date">
              <input
                className={inputClass(errors.start_date)}
                type="date"
                title="DD/MM/YYYY"
                value={form.start_date?.slice(0, 10) || ''}
                onChange={set('start_date')}
              />
            </FormField>

            <FormField label="End Date" required error={errors.end_date} name="end_date">
              <input
                className={inputClass(errors.end_date)}
                type="date"
                title="DD/MM/YYYY"
                value={form.end_date?.slice(0, 10) || ''}
                onChange={set('end_date')}
              />
            </FormField>

            <FormField label="Expected Revenue" name="expected_revenue">
              <RsAmountInput value={form.expected_revenue} onChange={set('expected_revenue')} name="expected_revenue" />
            </FormField>

            <FormField label="Budgeted Cost" name="budgeted_cost">
              <RsAmountInput value={form.budgeted_cost} onChange={set('budgeted_cost')} name="budgeted_cost" />
            </FormField>

            <FormField label="Actual Cost" name="actual_cost">
              <RsAmountInput value={form.actual_cost} onChange={set('actual_cost')} name="actual_cost" />
            </FormField>

            <FormField label="Expected Response" name="expected_response">
              <input className="input" type="number" min={0} step="any" value={form.expected_response} onChange={set('expected_response')} />
            </FormField>

            <FormField label="Numbers sent" name="numbers_sent">
              <input className="input" type="number" min={0} step={1} value={form.numbers_sent} onChange={set('numbers_sent')} />
            </FormField>
          </div>

          <SectionTitle>Description Information</SectionTitle>
          <FormField label="Description" name="description">
            <textarea className="input min-h-[120px] w-full" value={form.description} onChange={set('description')} />
          </FormField>
        </div>
      </div>
    </CRMLayout>
  );
}
