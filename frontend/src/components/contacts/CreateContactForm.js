'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import CRMLayout from '../layout/CRMLayout.js';
import FormField, { inputClass } from '../forms/FormField.js';
import { useToast } from '../ui/Toast.js';
import { getApiError } from '../../lib/api.js';
import { LEAD_SOURCES } from '../../lib/constants.js';
import { validateRequired, validateEmail, validatePhone } from '../../lib/validators.js';
import * as contactsApi from '../../lib/services/contacts.js';
import { fetchAccountLookups } from '../../lib/services/lookups.js';

export function emptyContactForm() {
  return {
    first_name: '', last_name: '', email: '', phone: '', mobile: '',
    account_id: '', title: '', department: '', lead_source: '', description: '',
  };
}

function SectionTitle({ children }) {
  return <p className="text-xs font-semibold text-zoho-muted uppercase tracking-wider mb-3 mt-6 first:mt-0">{children}</p>;
}

export default function CreateContactForm() {
  const router = useRouter();
  const { showToast } = useToast();
  const [form, setForm] = useState(emptyContactForm);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [accounts, setAccounts] = useState([]);

  useEffect(() => {
    fetchAccountLookups().then(setAccounts).catch(() => setAccounts([]));
  }, []);

  const set = (field) => (e) => {
    setForm((f) => ({ ...f, [field]: e.target.value }));
    setErrors((er) => ({ ...er, [field]: null }));
  };

  const handleSave = async () => {
    const errs = validateRequired({ last_name: 'Last Name', account_id: 'Account Name', email: 'Email', phone: 'Phone' }, form);
    const emailErr = validateEmail(form.email);
    const phoneErr = validatePhone(form.phone);
    if (emailErr) errs.email = emailErr;
    if (phoneErr) errs.phone = phoneErr;
    setErrors(errs);
    if (Object.keys(errs).length) {
      showToast('Please fill in all required fields before saving.');
      return;
    }
    setSaving(true);
    try {
      const created = await contactsApi.createContact(form);
      showToast('Contact saved', 'success');
      router.push(created?.id ? `/contacts/${created.id}` : '/contacts');
    } catch (err) {
      showToast(getApiError(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <CRMLayout>
      <div className="p-6 max-w-5xl mx-auto w-full">
        <Link href="/contacts" className="inline-flex items-center gap-1.5 text-xs font-medium text-zoho-muted hover:text-brand-600 transition-colors mb-4">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          Contacts
        </Link>

        <h1 className="text-lg font-semibold text-zoho-text mb-6">Create Contact</h1>

        <div className="card p-6">
          <SectionTitle>Contact Information</SectionTitle>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
            <FormField label="First Name" name="first_name">
              <input className="input" value={form.first_name} onChange={set('first_name')} />
            </FormField>
            <FormField label="Last Name" required error={errors.last_name} name="last_name">
              <input className={inputClass(errors.last_name)} value={form.last_name} onChange={set('last_name')} />
            </FormField>
            <FormField label="Account Name" required error={errors.account_id} name="account_id">
              <select className={inputClass(errors.account_id)} value={form.account_id} onChange={set('account_id')}>
                <option value="">--None--</option>
                {accounts.map((a) => <option key={a.value} value={a.value}>{a.label || a.name}</option>)}
              </select>
            </FormField>
            <FormField label="Job Title">
              <input className="input" value={form.title} onChange={set('title')} />
            </FormField>
            <FormField label="Department">
              <input className="input" value={form.department} onChange={set('department')} />
            </FormField>
            <FormField label="Lead Source">
              <select className="input" value={form.lead_source} onChange={set('lead_source')}>
                <option value="">--None--</option>
                {LEAD_SOURCES.map((s) => <option key={s}>{s}</option>)}
              </select>
            </FormField>
          </div>

          <SectionTitle>Contact Details</SectionTitle>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
            <FormField label="Email" required error={errors.email} name="email">
              <input className={inputClass(errors.email)} type="email" value={form.email} onChange={set('email')} />
            </FormField>
            <FormField label="Phone" required error={errors.phone} name="phone">
              <input className={inputClass(errors.phone)} value={form.phone} onChange={set('phone')} />
            </FormField>
            <FormField label="Mobile">
              <input className="input" value={form.mobile} onChange={set('mobile')} />
            </FormField>
          </div>

          <SectionTitle>Description</SectionTitle>
          <FormField label="Description">
            <textarea className="input min-h-[100px] resize-y" placeholder="Add a description..." value={form.description} onChange={set('description')} />
          </FormField>

          <div className="flex gap-2 justify-end pt-6 mt-4 border-t border-zoho-border">
            <Link href="/contacts" className="btn-secondary">Cancel</Link>
            <button type="button" onClick={handleSave} disabled={saving} className="btn-primary">
              {saving ? 'Saving...' : 'Save Contact'}
            </button>
          </div>
        </div>
      </div>
    </CRMLayout>
  );
}
