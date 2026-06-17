'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import CRMLayout from '../layout/CRMLayout.js';
import FormField, { inputClass } from '../forms/FormField.js';
import { useToast } from '../ui/Toast.js';
import { getApiError } from '../../lib/api.js';
import { LEAD_SOURCES, SALUTATIONS, RATINGS, INDUSTRIES } from '../../lib/constants.js';
import { PIPELINE_LEAD } from '../../lib/pipelineHelpers.js';
import { validateRequired, validateEmail, validatePhone } from '../../lib/validators.js';
import * as leadsApi from '../../lib/services/leads.js';
import { fetchLeadStatuses, FALLBACK_LEAD_STATUSES } from '../../lib/services/lookups.js';

export function emptyLeadForm() {
  return {
    salutation: '', first_name: '', last_name: '', email: '', phone: '', mobile: '',
    company: '', title: '', lead_status: PIPELINE_LEAD, source: '', industry: '',
    rating: '', website: '', annual_revenue: '', no_of_employees: '',
    proposal_amount: '',
    street: '', city: '', state: '', zip_code: '', country: 'India',
    description: '',
  };
}

const REQUIRED = { last_name: 'Last Name', company: 'Company', email: 'Email', phone: 'Phone', lead_status: 'Lead Status' };

function SectionTitle({ children }) {
  return <p className="text-xs font-semibold text-zoho-muted uppercase tracking-wider mb-3 mt-6 first:mt-0">{children}</p>;
}

export default function CreateLeadForm() {
  const router = useRouter();
  const { showToast } = useToast();
  const [form, setForm] = useState(emptyLeadForm);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [statusOptions, setStatusOptions] = useState(FALLBACK_LEAD_STATUSES);

  useEffect(() => {
    fetchLeadStatuses().then(setStatusOptions).catch(() => setStatusOptions(FALLBACK_LEAD_STATUSES));
  }, []);

  const set = (field) => (e) => {
    setForm((f) => ({ ...f, [field]: e.target.value }));
    setErrors((er) => ({ ...er, [field]: null }));
  };

  const validate = () => {
    const errs = validateRequired(REQUIRED, form);
    const emailErr = validateEmail(form.email);
    const phoneErr = validatePhone(form.phone);
    if (emailErr) errs.email = emailErr;
    if (phoneErr) errs.phone = phoneErr;
    setErrors(errs);
    if (Object.keys(errs).length) {
      showToast('Please fill in all required fields before saving.');
      document.querySelector(`[data-field="${Object.keys(errs)[0]}"]`)?.scrollIntoView({ behavior: 'smooth' });
      return false;
    }
    return true;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      const created = await leadsApi.createLead(form);
      showToast('Lead saved', 'success');
      router.push(created?.id ? `/leads/${created.id}` : '/leads');
    } catch (err) {
      showToast(getApiError(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <CRMLayout>
      <div className="p-6 max-w-5xl mx-auto w-full">
        <Link href="/leads" className="inline-flex items-center gap-1.5 text-xs font-medium text-zoho-muted hover:text-brand-600 transition-colors mb-4">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          Leads
        </Link>

        <h1 className="text-lg font-semibold text-zoho-text mb-6">Create Lead</h1>

        <div className="card p-6">
          <SectionTitle>Lead Information</SectionTitle>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
            <div className="sm:col-span-2 grid grid-cols-[120px_1fr_1fr] gap-3">
              <FormField label="Salutation">
                <select className="input" value={form.salutation} onChange={set('salutation')}>
                  <option value="">--None--</option>
                  {SALUTATIONS.map((s) => <option key={s}>{s}</option>)}
                </select>
              </FormField>
              <FormField label="First Name" name="first_name">
                <input className="input" value={form.first_name} onChange={set('first_name')} />
              </FormField>
              <FormField label="Last Name" required error={errors.last_name} name="last_name">
                <input className={inputClass(errors.last_name)} value={form.last_name} onChange={set('last_name')} />
              </FormField>
            </div>
            <FormField label="Company" required error={errors.company} name="company">
              <input className={inputClass(errors.company)} value={form.company} onChange={set('company')} />
            </FormField>
            <FormField label="Job Title" name="title">
              <input className="input" value={form.title} onChange={set('title')} />
            </FormField>
            <FormField label="Lead Status" required error={errors.lead_status} name="lead_status">
              <select className={inputClass(errors.lead_status)} value={form.lead_status} onChange={set('lead_status')}>
                {statusOptions.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </FormField>
            <FormField label="Lead Source">
              <select className="input" value={form.source} onChange={set('source')}>
                <option value="">--None--</option>
                {LEAD_SOURCES.map((s) => <option key={s}>{s}</option>)}
              </select>
            </FormField>
            <FormField label="Industry">
              <select className="input" value={form.industry} onChange={set('industry')}>
                <option value="">--None--</option>
                {INDUSTRIES.map((i) => <option key={i}>{i}</option>)}
              </select>
            </FormField>
            <FormField label="Rating">
              <select className="input" value={form.rating} onChange={set('rating')}>
                <option value="">--None--</option>
                {RATINGS.map((r) => <option key={r}>{r}</option>)}
              </select>
            </FormField>
            <FormField label="Annual Revenue">
              <input className="input" type="number" placeholder="₹" value={form.annual_revenue} onChange={set('annual_revenue')} />
            </FormField>
            <FormField label="Proposal Amount">
              <input className="input" type="number" placeholder="₹" value={form.proposal_amount} onChange={set('proposal_amount')} />
            </FormField>
            <FormField label="No. of Employees">
              <input className="input" type="number" value={form.no_of_employees} onChange={set('no_of_employees')} />
            </FormField>
            <FormField label="Website">
              <input className="input" placeholder="https://" value={form.website} onChange={set('website')} />
            </FormField>
          </div>

          <SectionTitle>Contact Information</SectionTitle>
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

          <SectionTitle>Address Information</SectionTitle>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
            <div className="sm:col-span-2">
              <FormField label="Street">
                <input className="input" value={form.street} onChange={set('street')} />
              </FormField>
            </div>
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
            <Link href="/leads" className="btn-secondary">Cancel</Link>
            <button type="button" onClick={handleSave} disabled={saving} className="btn-primary">
              {saving ? 'Saving...' : 'Save Lead'}
            </button>
          </div>
        </div>
      </div>
    </CRMLayout>
  );
}
