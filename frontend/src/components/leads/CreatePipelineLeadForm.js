'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import CRMLayout from '../layout/CRMLayout.js';
import FormField, { inputClass } from '../forms/FormField.js';
import { useToast } from '../ui/Toast.js';
import { useAuth } from '../../hooks/useAuth.js';
import { getApiError } from '../../lib/api.js';
import { validateRequired, validateEmail } from '../../lib/validators.js';
import { fetchUsers, fetchLeadStatuses, FALLBACK_LEAD_STATUSES } from '../../lib/services/lookups.js';
import {
  LEAD_SOURCES, SALUTATIONS, RATINGS, INDUSTRIES,
} from '../../lib/constants.js';

const COUNTRIES = ['India', 'United States', 'United Kingdom', 'Canada', 'Australia', 'Singapore', 'UAE', 'Other'];
const INDIAN_STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 'Goa', 'Gujarat',
  'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka', 'Kerala', 'Madhya Pradesh',
  'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab',
  'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura', 'Uttar Pradesh',
  'Uttarakhand', 'West Bengal', 'Delhi', 'Jammu and Kashmir', 'Ladakh',
];

export function emptyPipelineLeadForm(ownerId = '', defaults = {}) {
  return {
    owner_id: ownerId,
    salutation: '',
    first_name: '',
    title: '',
    phone: '',
    mobile: '',
    source: '',
    industry: '',
    annual_revenue: '',
    proposal_amount: '',
    email_opt_out: false,
    company: '',
    last_name: '',
    email: '',
    fax: '',
    website: '',
    lead_status: '',
    no_of_employees: '',
    rating: '',
    skype_id: '',
    secondary_email: '',
    twitter: '',
    country: '',
    building: '',
    street: '',
    city: '',
    state: '',
    zip_code: '',
    latitude: '',
    longitude: '',
    description: '',
    ...defaults,
  };
}

const REQUIRED = { first_name: 'First Name', last_name: 'Last Name', company: 'Company', email: 'Email' };

function SectionTitle({ children }) {
  return <p className="text-xs font-semibold text-zoho-muted uppercase tracking-wider mb-3 mt-6 first:mt-0">{children}</p>;
}

function noneSelect(value, onChange, options, placeholder = '--None--') {
  return (
    <select className="input" value={value} onChange={onChange}>
      <option value="">{placeholder}</option>
      {options.map((o) => (typeof o === 'string'
        ? <option key={o} value={o}>{o}</option>
        : <option key={o.value} value={o.value}>{o.label}</option>))}
    </select>
  );
}

export default function CreatePipelineLeadForm({
  listPath,
  listLabel,
  title,
  saveLabel,
  successToast,
  emptyFormDefaults = {},
  createFn,
  showLeadStatus = false,
  showLeadSource = true,
}) {
  const router = useRouter();
  const { showToast } = useToast();
  const { user } = useAuth();
  const [form, setForm] = useState(() => emptyPipelineLeadForm(user?.id || '', emptyFormDefaults));
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [users, setUsers] = useState([]);
  const [statusOptions, setStatusOptions] = useState(FALLBACK_LEAD_STATUSES);

  useEffect(() => {
    if (user?.id) setForm((f) => ({ ...f, owner_id: f.owner_id || user.id }));
    Promise.all([fetchUsers(), fetchLeadStatuses()])
      .then(([u, s]) => { setUsers(u); setStatusOptions(s); })
      .catch(() => {});
  }, [user?.id]);

  const set = (field) => (e) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setForm((f) => ({ ...f, [field]: value }));
    setErrors((er) => ({ ...er, [field]: null }));
  };

  const clearAddress = () => {
    setForm((f) => ({
      ...f,
      country: '', building: '', street: '', city: '', state: '', zip_code: '', latitude: '', longitude: '',
    }));
  };

  const validate = () => {
    const errs = validateRequired(REQUIRED, form);
    const emailErr = validateEmail(form.email);
    if (emailErr) errs.email = emailErr;
    if (form.secondary_email) {
      const secErr = validateEmail(form.secondary_email);
      if (secErr) errs.secondary_email = secErr;
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) {
      showToast('Please fill in required fields.');
      return;
    }
    setSaving(true);
    try {
      const created = await createFn(form);
      showToast(successToast, 'success');
      router.push(created?.id ? `${listPath}/${created.id}` : listPath);
    } catch (err) {
      showToast(getApiError(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <CRMLayout>
      <div className="p-6 max-w-5xl mx-auto w-full">
        <Link href={listPath} className="inline-flex items-center gap-1.5 text-xs font-medium text-zoho-muted hover:text-brand-600 transition-colors mb-4">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          {listLabel}
        </Link>

        <h1 className="text-lg font-semibold text-zoho-text mb-6">{title}</h1>

        <div className="card p-6">
          <SectionTitle>Lead Information</SectionTitle>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
            <FormField label="Lead Owner" name="owner_id">
              <select className="input" value={form.owner_id} onChange={set('owner_id')}>
                {users.length === 0 && user && (
                  <option value={user.id}>{`${user.first_name || ''} ${user.last_name || ''}`.trim() || user.email}</option>
                )}
                {users.map((u) => (
                  <option key={u.id || u.value} value={u.id || u.value}>{u.name}</option>
                ))}
              </select>
            </FormField>
            <div className="sm:col-span-2 grid grid-cols-[120px_1fr] gap-3">
              <FormField label="First Name">
                {noneSelect(form.salutation, set('salutation'), SALUTATIONS)}
              </FormField>
              <FormField label="First Name" required error={errors.first_name} name="first_name">
                <input className={inputClass(errors.first_name)} placeholder="First Name" value={form.first_name} onChange={set('first_name')} />
              </FormField>
            </div>
            <FormField label="Title" name="title">
              <input className="input" value={form.title} onChange={set('title')} />
            </FormField>
            <FormField label="Phone" name="phone">
              <input className="input" value={form.phone} onChange={set('phone')} />
            </FormField>
            <FormField label="Mobile" name="mobile">
              <input className="input" value={form.mobile} onChange={set('mobile')} />
            </FormField>
            {showLeadSource && (
              <FormField label="Lead Source" name="source">
                {noneSelect(form.source, set('source'), LEAD_SOURCES)}
              </FormField>
            )}
            <FormField label="Industry" name="industry">
              {noneSelect(form.industry, set('industry'), INDUSTRIES)}
            </FormField>
            <FormField label="Annual Revenue" name="annual_revenue">
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-zoho-muted">Rs.</span>
                <input className="input pl-10" type="number" value={form.annual_revenue} onChange={set('annual_revenue')} />
              </div>
            </FormField>
            <FormField label="Proposal Amount" name="proposal_amount">
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-zoho-muted">Rs.</span>
                <input className="input pl-10" type="number" value={form.proposal_amount} onChange={set('proposal_amount')} />
              </div>
            </FormField>
            <FormField label="Email Opt Out" name="email_opt_out">
              <label className="flex items-center gap-2 text-sm h-10">
                <input type="checkbox" checked={form.email_opt_out} onChange={set('email_opt_out')} />
                Opt out of emails
              </label>
            </FormField>
            <FormField label="Company" required error={errors.company} name="company">
              <input className={inputClass(errors.company)} value={form.company} onChange={set('company')} />
            </FormField>
            <FormField label="Last Name" required error={errors.last_name} name="last_name">
              <input className={inputClass(errors.last_name)} value={form.last_name} onChange={set('last_name')} />
            </FormField>
            <FormField label="Email" required error={errors.email} name="email">
              <input className={inputClass(errors.email)} type="email" value={form.email} onChange={set('email')} />
            </FormField>
            <FormField label="Fax" name="fax">
              <input className="input" value={form.fax} onChange={set('fax')} />
            </FormField>
            <FormField label="Website" name="website">
              <input className="input" placeholder="https://" value={form.website} onChange={set('website')} />
            </FormField>
            {showLeadStatus && (
              <FormField label="Lead Status" name="lead_status">
                {noneSelect(form.lead_status, set('lead_status'), statusOptions, '--None--')}
              </FormField>
            )}
            <FormField label="No. of Employees" name="no_of_employees">
              <input className="input" type="number" value={form.no_of_employees} onChange={set('no_of_employees')} />
            </FormField>
            <FormField label="Rating" name="rating">
              {noneSelect(form.rating, set('rating'), RATINGS)}
            </FormField>
            <FormField label="Skype ID" name="skype_id">
              <input className="input" value={form.skype_id} onChange={set('skype_id')} />
            </FormField>
            <FormField label="Secondary Email" error={errors.secondary_email} name="secondary_email">
              <input className={inputClass(errors.secondary_email)} type="email" value={form.secondary_email} onChange={set('secondary_email')} />
            </FormField>
            <FormField label="Twitter" name="twitter">
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-zoho-muted">@</span>
                <input className="input pl-8" value={form.twitter} onChange={set('twitter')} placeholder="username" />
              </div>
            </FormField>
          </div>

          <SectionTitle>Address Information</SectionTitle>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-2">
            <FormField label="Country / Region" name="country">
              {noneSelect(form.country, set('country'), COUNTRIES)}
            </FormField>
            <FormField label="Flat / House No./ Building / Apartment Name" name="building">
              <input className="input" value={form.building} onChange={set('building')} />
            </FormField>
            <div className="sm:col-span-2">
              <FormField label="Street Address" name="street">
                <input className="input" value={form.street} onChange={set('street')} />
              </FormField>
            </div>
            <FormField label="City" name="city">
              <input className="input" value={form.city} onChange={set('city')} />
            </FormField>
            <FormField label="State / Province" name="state">
              {noneSelect(form.state, set('state'), INDIAN_STATES)}
            </FormField>
            <FormField label="Zip / Postal Code" name="zip_code">
              <input className="input" value={form.zip_code} onChange={set('zip_code')} />
            </FormField>
            <div className="sm:col-span-2">
              <p className="text-xs font-medium text-zoho-muted mb-2">Coordinates</p>
              <div className="grid grid-cols-2 gap-3">
                <FormField label="Latitude" name="latitude">
                  <input className="input" type="number" step="any" value={form.latitude} onChange={set('latitude')} />
                </FormField>
                <FormField label="Longitude" name="longitude">
                  <input className="input" type="number" step="any" value={form.longitude} onChange={set('longitude')} />
                </FormField>
              </div>
            </div>
          </div>
          <button type="button" onClick={clearAddress} className="text-xs text-brand-600 hover:underline mb-4">Clear All</button>

          <SectionTitle>Description Information</SectionTitle>
          <FormField label="Description" name="description">
            <textarea className="input min-h-[100px] resize-y" value={form.description} onChange={set('description')} />
          </FormField>

          <div className="flex gap-2 justify-end pt-6 mt-4 border-t border-zoho-border">
            <Link href={listPath} className="btn-secondary">Cancel</Link>
            <button type="button" onClick={handleSave} disabled={saving} className="btn-primary">
              {saving ? 'Saving...' : saveLabel}
            </button>
          </div>
        </div>
      </div>
    </CRMLayout>
  );
}
