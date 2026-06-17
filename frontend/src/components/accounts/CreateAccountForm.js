'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import CRMLayout from '../layout/CRMLayout.js';
import FormField, { inputClass } from '../forms/FormField.js';
import { useToast } from '../ui/Toast.js';
import { getApiError } from '../../lib/api.js';
import { ACCOUNT_TYPES } from '../../lib/constants.js';
import { validateRequired } from '../../lib/validators.js';
import * as accountsApi from '../../lib/services/accounts.js';

const INDUSTRIES = ['IT Services', 'E-Commerce', 'Automotive', 'EdTech', 'FinTech', 'Healthcare', 'Manufacturing', 'Retail', 'Other'];

export function emptyAccountForm() {
  return {
    account_name: '', phone: '', industry: '', account_type: '', website: '',
    annual_revenue: '', city: '', state: '', zip_code: '', country: 'India', description: '',
  };
}

function SectionTitle({ children }) {
  return <p className="text-xs font-semibold text-zoho-muted uppercase tracking-wider mb-3 mt-6 first:mt-0">{children}</p>;
}

export default function CreateAccountForm() {
  const router = useRouter();
  const { showToast } = useToast();
  const [form, setForm] = useState(emptyAccountForm);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const set = (field) => (e) => {
    setForm((f) => ({ ...f, [field]: e.target.value }));
    setErrors((er) => ({ ...er, [field]: null }));
  };

  const handleSave = async () => {
    const errs = validateRequired({ account_name: 'Account Name', phone: 'Phone' }, form);
    setErrors(errs);
    if (Object.keys(errs).length) {
      showToast('Please fill in all required fields before saving.');
      return;
    }
    setSaving(true);
    try {
      const created = await accountsApi.createAccount(form);
      showToast('Account saved', 'success');
      router.push(created?.id ? `/accounts/${created.id}` : '/accounts');
    } catch (err) {
      showToast(getApiError(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <CRMLayout>
      <div className="p-6 max-w-5xl mx-auto w-full">
        <Link href="/accounts" className="inline-flex items-center gap-1.5 text-xs font-medium text-zoho-muted hover:text-brand-600 transition-colors mb-4">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          Accounts
        </Link>

        <h1 className="text-lg font-semibold text-zoho-text mb-6">Create Account</h1>

        <div className="card p-6">
          <SectionTitle>Account Information</SectionTitle>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
            <div className="sm:col-span-2">
              <FormField label="Account Name" required error={errors.account_name} name="account_name">
                <input className={inputClass(errors.account_name)} value={form.account_name} onChange={set('account_name')} />
              </FormField>
            </div>
            <FormField label="Phone" required error={errors.phone} name="phone">
              <input className={inputClass(errors.phone)} value={form.phone} onChange={set('phone')} />
            </FormField>
            <FormField label="Website">
              <input className="input" placeholder="https://" value={form.website} onChange={set('website')} />
            </FormField>
            <FormField label="Industry">
              <select className="input" value={form.industry} onChange={set('industry')}>
                <option value="">--None--</option>
                {INDUSTRIES.map((i) => <option key={i}>{i}</option>)}
              </select>
            </FormField>
            <FormField label="Account Type">
              <select className="input" value={form.account_type} onChange={set('account_type')}>
                <option value="">--None--</option>
                {ACCOUNT_TYPES.map((t) => <option key={t}>{t}</option>)}
              </select>
            </FormField>
            <FormField label="Annual Revenue">
              <input className="input" type="number" placeholder="₹" value={form.annual_revenue} onChange={set('annual_revenue')} />
            </FormField>
          </div>

          <SectionTitle>Address Information</SectionTitle>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
            <FormField label="City">
              <input className="input" value={form.city} onChange={set('city')} />
            </FormField>
            <FormField label="State">
              <input className="input" value={form.state} onChange={set('state')} />
            </FormField>
            <FormField label="Zip Code">
              <input className="input" value={form.zip_code} onChange={set('zip_code')} />
            </FormField>
            <FormField label="Country">
              <input className="input" value={form.country} onChange={set('country')} />
            </FormField>
          </div>

          <SectionTitle>Description</SectionTitle>
          <FormField label="Description">
            <textarea className="input min-h-[100px] resize-y" placeholder="Add a description..." value={form.description} onChange={set('description')} />
          </FormField>

          <div className="flex gap-2 justify-end pt-6 mt-4 border-t border-zoho-border">
            <Link href="/accounts" className="btn-secondary">Cancel</Link>
            <button type="button" onClick={handleSave} disabled={saving} className="btn-primary">
              {saving ? 'Saving...' : 'Save Account'}
            </button>
          </div>
        </div>
      </div>
    </CRMLayout>
  );
}
