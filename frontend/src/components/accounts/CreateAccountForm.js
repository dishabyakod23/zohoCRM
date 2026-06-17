'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import CRMLayout from '../layout/CRMLayout.js';
import FormField, { inputClass } from '../forms/FormField.js';
import { useAuth } from '../../hooks/useAuth.js';
import { useToast } from '../ui/Toast.js';
import { getApiError } from '../../lib/api.js';
import { ACCOUNT_TYPES, RATINGS, INDUSTRIES } from '../../lib/constants.js';
import { validateRequired } from '../../lib/validators.js';
import * as accountsApi from '../../lib/services/accounts.js';
import { fetchAccountLookups, fetchContactLookups, fetchUsers } from '../../lib/services/lookups.js';
import { PlusIcon, TrashIcon } from '@heroicons/react/24/outline';

const OWNERSHIP_OPTIONS = ['Public', 'Private', 'Subsidiary', 'Other'];

export function emptyProjectRow() {
  return { name: '', deal_size: '' };
}

export function emptyAccountForm() {
  return {
    owner_id: '',
    account_name: '', account_site: '', parent_account_id: '', account_number: '',
    account_type: '', industry: '', annual_revenue: '', rating: '',
    phone: '', fax: '', website: '', ticker_symbol: '', ownership: '',
    employees: '', sic_code: '',
    billing_flat: '', billing_street: '', billing_city: '', billing_state: '',
    billing_country: '', billing_zip: '', billing_lat: '', billing_lng: '',
    shipping_flat: '', shipping_street: '', shipping_city: '', shipping_state: '',
    shipping_country: '', shipping_zip: '', shipping_lat: '', shipping_lng: '',
    description: '',
    deal_size: '',
    contact_ids: [],
    projects: [emptyProjectRow()],
  };
}

function SectionTitle({ children }) {
  return (
    <h3 className="text-sm font-semibold text-zoho-text border-b border-zoho-border pb-2 mb-4 mt-8 first:mt-0">
      {children}
    </h3>
  );
}

function AddressBlock({ prefix, label, form, set, copyFrom }) {
  const clearAll = () => {
    ['flat', 'street', 'city', 'state', 'country', 'zip', 'lat', 'lng'].forEach(f =>
      set(`${prefix}_${f}`)({ target: { value: '' } })
    );
  };
  return (
    <div className="flex-1 min-w-0">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-semibold text-zoho-muted uppercase tracking-wider">{label}</p>
        {copyFrom && (
          <button type="button" onClick={copyFrom} className="text-xs text-brand-600 hover:underline">
            Copy Billing Address
          </button>
        )}
      </div>
      <div className="space-y-3">
        <FormField label="Country / Region" name={`${prefix}_country`}>
          <input className="input" placeholder="—None—" value={form[`${prefix}_country`]} onChange={set(`${prefix}_country`)} />
        </FormField>
        <FormField label="Flat / House No. / Building / Apartment Name" name={`${prefix}_flat`}>
          <input className="input" value={form[`${prefix}_flat`]} onChange={set(`${prefix}_flat`)} />
        </FormField>
        <FormField label="Street Address" name={`${prefix}_street`}>
          <input className="input" value={form[`${prefix}_street`]} onChange={set(`${prefix}_street`)} />
        </FormField>
        <FormField label="City" name={`${prefix}_city`}>
          <input className="input" value={form[`${prefix}_city`]} onChange={set(`${prefix}_city`)} />
        </FormField>
        <FormField label="State / Province" name={`${prefix}_state`}>
          <input className="input" placeholder="—None—" value={form[`${prefix}_state`]} onChange={set(`${prefix}_state`)} />
        </FormField>
        <FormField label="Zip / Postal Code" name={`${prefix}_zip`}>
          <input className="input" value={form[`${prefix}_zip`]} onChange={set(`${prefix}_zip`)} />
        </FormField>
        <div className="grid grid-cols-2 gap-3">
          <FormField label="Latitude" name={`${prefix}_lat`}>
            <input className="input" type="number" step="any" placeholder="Latitude"
              value={form[`${prefix}_lat`]} onChange={set(`${prefix}_lat`)} />
          </FormField>
          <FormField label="Longitude" name={`${prefix}_lng`}>
            <input className="input" type="number" step="any" placeholder="Longitude"
              value={form[`${prefix}_lng`]} onChange={set(`${prefix}_lng`)} />
          </FormField>
        </div>
        <button type="button" onClick={clearAll} className="text-xs text-gray-400 hover:text-red-500">
          Clear All
        </button>
      </div>
    </div>
  );
}

export default function CreateAccountForm() {
  const router = useRouter();
  const { user } = useAuth();
  const { showToast } = useToast();
  const [form, setForm] = useState(() => ({ ...emptyAccountForm(), owner_id: user?.id || '' }));
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [users, setUsers] = useState([]);
  const [parentAccounts, setParentAccounts] = useState([]);
  const [contactOptions, setContactOptions] = useState([]);

  useEffect(() => {
    fetchUsers().then(setUsers).catch(() => setUsers([]));
    fetchAccountLookups().then(setParentAccounts).catch(() => setParentAccounts([]));
    fetchContactLookups().then(setContactOptions).catch(() => setContactOptions([]));
  }, []);

  const set = (field) => (e) => {
    setForm((f) => ({ ...f, [field]: e.target.value }));
    setErrors((er) => ({ ...er, [field]: null }));
  };

  const copyBillingToShipping = () => {
    setForm(f => ({
      ...f,
      shipping_flat: f.billing_flat,
      shipping_street: f.billing_street,
      shipping_city: f.billing_city,
      shipping_state: f.billing_state,
      shipping_country: f.billing_country,
      shipping_zip: f.billing_zip,
      shipping_lat: f.billing_lat,
      shipping_lng: f.billing_lng,
    }));
  };

  const toggleContact = (contactId) => {
    setForm((f) => ({
      ...f,
      contact_ids: f.contact_ids.includes(contactId)
        ? f.contact_ids.filter((id) => id !== contactId)
        : [...f.contact_ids, contactId],
    }));
  };

  const updateProject = (index, field, value) => {
    setForm((f) => ({
      ...f,
      projects: f.projects.map((row, i) => (i === index ? { ...row, [field]: value } : row)),
    }));
  };

  const addProjectRow = () => {
    setForm((f) => ({ ...f, projects: [...f.projects, emptyProjectRow()] }));
  };

  const removeProjectRow = (index) => {
    setForm((f) => ({
      ...f,
      projects: f.projects.length > 1 ? f.projects.filter((_, i) => i !== index) : [emptyProjectRow()],
    }));
  };

  const handleSave = async () => {
    const errs = validateRequired({ account_name: 'Account Name' }, form);
    setErrors(errs);
    if (Object.keys(errs).length) {
      showToast('Please fill in all required fields before saving.');
      return;
    }
    setSaving(true);
    try {
      const created = await accountsApi.createAccountWithRelations(form);
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

        <div className="flex items-center justify-between mb-6">
          <h1 className="text-lg font-semibold text-zoho-text">Create Account</h1>
          <div className="flex gap-2">
            <Link href="/accounts" className="btn-secondary">Cancel</Link>
            <button type="button" onClick={handleSave} disabled={saving} className="btn-primary">
              {saving ? 'Saving…' : 'Save Account'}
            </button>
          </div>
        </div>

        <div className="card p-6 space-y-0">

          {/* ── Account Information ── */}
          <SectionTitle>Account Information</SectionTitle>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">

            <FormField label="Account Owner" name="owner_id">
              <select className="input" value={form.owner_id} onChange={set('owner_id')}>
                <option value="">—None—</option>
                {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </FormField>

            <div /> {/* spacer */}

            <FormField label="Account Name" required error={errors.account_name} name="account_name">
              <input className={inputClass(errors.account_name)} value={form.account_name} onChange={set('account_name')} />
            </FormField>

            <FormField label="Account Site" name="account_site">
              <input className="input" value={form.account_site} onChange={set('account_site')} />
            </FormField>

            <FormField label="Parent Account" name="parent_account_id">
              <select className="input" value={form.parent_account_id} onChange={set('parent_account_id')}>
                <option value="">—None—</option>
                {parentAccounts.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
              </select>
            </FormField>

            <FormField label="Account Number" name="account_number">
              <input className="input" value={form.account_number} onChange={set('account_number')} />
            </FormField>

            <FormField label="Account Type" name="account_type">
              <select className="input" value={form.account_type} onChange={set('account_type')}>
                <option value="">—None—</option>
                {ACCOUNT_TYPES.map(t => <option key={t}>{t}</option>)}
              </select>
            </FormField>

            <FormField label="Industry" name="industry">
              <select className="input" value={form.industry} onChange={set('industry')}>
                <option value="">—None—</option>
                {INDUSTRIES.map(i => <option key={i}>{i}</option>)}
              </select>
            </FormField>

            <FormField label="Annual Revenue" name="annual_revenue">
              <div className="flex items-center gap-1.5">
                <span className="text-sm text-zoho-muted shrink-0">Rs.</span>
                <input className="input flex-1" type="number" min="0" step="any"
                  value={form.annual_revenue} onChange={set('annual_revenue')} />
              </div>
            </FormField>

            <FormField label="Rating" name="rating">
              <select className="input" value={form.rating} onChange={set('rating')}>
                <option value="">—None—</option>
                {RATINGS.map(r => <option key={r}>{r}</option>)}
              </select>
            </FormField>

            <FormField label="Phone" error={errors.phone} name="phone">
              <input className={inputClass(errors.phone)} value={form.phone} onChange={set('phone')} />
            </FormField>

            <FormField label="Fax" name="fax">
              <input className="input" value={form.fax} onChange={set('fax')} />
            </FormField>

            <FormField label="Website" name="website">
              <input className="input" placeholder="https://" value={form.website} onChange={set('website')} />
            </FormField>

            <FormField label="Ticker Symbol" name="ticker_symbol">
              <input className="input" value={form.ticker_symbol} onChange={set('ticker_symbol')} />
            </FormField>

            <FormField label="Ownership" name="ownership">
              <select className="input" value={form.ownership} onChange={set('ownership')}>
                <option value="">—None—</option>
                {OWNERSHIP_OPTIONS.map(o => <option key={o}>{o}</option>)}
              </select>
            </FormField>

            <FormField label="Employees" name="employees">
              <input className="input" type="number" min="0" value={form.employees} onChange={set('employees')} />
            </FormField>

            <FormField label="SIC Code" name="sic_code">
              <input className="input" value={form.sic_code} onChange={set('sic_code')} />
            </FormField>

          </div>

          {/* ── Address Information ── */}
          <SectionTitle>Address Information</SectionTitle>
          <div className="flex flex-col sm:flex-row gap-8">
            <AddressBlock prefix="billing" label="Billing Address" form={form} set={set} />
            <AddressBlock prefix="shipping" label="Shipping Address" form={form} set={set} copyFrom={copyBillingToShipping} />
          </div>

          {/* ── Deal & Related Records ── */}
          <SectionTitle>Deal & Related Records</SectionTitle>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
            <FormField label="Deal Size" name="deal_size">
              <div className="flex items-center gap-1.5">
                <span className="text-sm text-zoho-muted shrink-0">Rs.</span>
                <input className="input flex-1" type="number" min="0" step="any"
                  value={form.deal_size} onChange={set('deal_size')} />
              </div>
            </FormField>
          </div>

          <FormField label="Contact List" name="contact_ids">
            {contactOptions.length === 0 ? (
              <p className="text-sm text-zoho-muted">No contacts available. Create contacts first, then link them here.</p>
            ) : (
              <div className="border border-zoho-border rounded-lg max-h-48 overflow-y-auto divide-y divide-zoho-border">
                {contactOptions.map((contact) => (
                  <label key={contact.value} className="flex items-center gap-3 px-3 py-2 hover:bg-gray-50 cursor-pointer">
                    <input
                      type="checkbox"
                      className="rounded border-gray-300 text-brand-600 focus:ring-brand-500"
                      checked={form.contact_ids.includes(contact.value)}
                      onChange={() => toggleContact(contact.value)}
                    />
                    <span className="text-sm text-zoho-text">{contact.label}</span>
                    {contact.email && <span className="text-xs text-zoho-muted ml-auto">{contact.email}</span>}
                  </label>
                ))}
              </div>
            )}
          </FormField>

          <div className="mt-6">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold text-zoho-muted uppercase tracking-wider">Projects</p>
              <button type="button" onClick={addProjectRow} className="text-xs text-brand-600 hover:underline inline-flex items-center gap-1">
                <PlusIcon className="w-3.5 h-3.5" /> Add Project
              </button>
            </div>
            <div className="space-y-3">
              {form.projects.map((project, index) => (
                <div key={index} className="grid grid-cols-1 sm:grid-cols-[1fr_180px_auto] gap-3 items-end">
                  <FormField label={index === 0 ? 'Project Name' : undefined} name={`project_name_${index}`}>
                    <input className="input" placeholder="Project name"
                      value={project.name} onChange={(e) => updateProject(index, 'name', e.target.value)} />
                  </FormField>
                  <FormField label={index === 0 ? 'Deal Size' : undefined} name={`project_deal_size_${index}`}>
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm text-zoho-muted shrink-0">Rs.</span>
                      <input className="input flex-1" type="number" min="0" step="any" placeholder="0"
                        value={project.deal_size} onChange={(e) => updateProject(index, 'deal_size', e.target.value)} />
                    </div>
                  </FormField>
                  <button type="button" onClick={() => removeProjectRow(index)}
                    className="btn-secondary px-2.5 py-2 mb-0.5" title="Remove project">
                    <TrashIcon className="w-4 h-4 text-gray-500" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* ── Description ── */}
          <SectionTitle>Description Information</SectionTitle>
          <FormField label="Description" name="description">
            <textarea className="input min-h-[100px] resize-y" placeholder="Add a description…"
              value={form.description} onChange={set('description')} />
          </FormField>

        </div>

        <div className="flex gap-2 justify-end pt-4">
          <Link href="/accounts" className="btn-secondary">Cancel</Link>
          <button type="button" onClick={handleSave} disabled={saving} className="btn-primary">
            {saving ? 'Saving…' : 'Save Account'}
          </button>
        </div>
      </div>
    </CRMLayout>
  );
}
