'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import CRMLayout from '../layout/CRMLayout.js';
import FormField, { inputClass } from '../forms/FormField.js';
import { useAuth } from '../../hooks/useAuth.js';
import { useToast } from '../ui/Toast.js';
import { getApiError } from '../../lib/api.js';
import { LEAD_SOURCES, SALUTATIONS } from '../../lib/constants.js';
import { validateRequired, validateEmail, validatePhone } from '../../lib/validators.js';
import { validateEmailUnique } from '../../lib/emailHelpers.js';
import { useEmailFieldError } from '../../hooks/useEmailUniqueValidation.js';
import * as contactsApi from '../../lib/services/contacts.js';
import { fetchAccountLookups, fetchUsers } from '../../lib/services/lookups.js';
import AccountNameCombobox from '../forms/AccountNameCombobox.js';
import { resolveContactAccountId } from '../../lib/resolveContactAccount.js';

export function emptyContactForm() {
  return {
    salutation: '', first_name: '', last_name: '', account_id: '', account_name: '',
    title: '', department: '', lead_source: '', owner_id: '',
    assistant: '', asst_phone: '', date_of_birth: '',
    email_opt_out: false,
    email: '', secondary_email: '', phone: '', other_phone: '', mobile: '',
    home_phone: '', fax: '', skype_id: '', twitter: '', website: '',
    mailing_flat: '', mailing_street: '', mailing_city: '', mailing_state: '',
    mailing_country: '', mailing_zip: '', mailing_lat: '', mailing_lng: '',
    other_flat: '', other_street: '', other_city: '', other_state: '',
    other_country: '', other_zip: '', other_lat: '', other_lng: '',
    description: '',
  };
}

function SectionTitle({ children }) {
  return (
    <h3 className="text-sm font-semibold text-zoho-text border-b border-zoho-border py-3 mb-6 mt-10 first:mt-0">
      {children}
    </h3>
  );
}

function AddressBlock({ prefix, label, form, set, copyFrom }) {
  return (
    <div className="flex-1 min-w-0">
      <div className="flex items-center justify-between mb-5 pt-1">
        <p className="text-xs font-semibold text-zoho-muted uppercase tracking-wider">{label}</p>
        {copyFrom && (
          <button type="button" onClick={copyFrom}
            className="text-xs text-brand-600 hover:underline">
            Copy Mailing Address
          </button>
        )}
      </div>
      <div className="space-y-4">
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
        <button type="button" onClick={() => {
          const fields = ['flat', 'street', 'city', 'state', 'country', 'zip', 'lat', 'lng'];
          fields.forEach(f => set(`${prefix}_${f}`)({ target: { value: '' } }));
        }} className="text-xs text-gray-400 hover:text-red-500">
          Clear All
        </button>
      </div>
    </div>
  );
}

export default function CreateContactForm() {
  const router = useRouter();
  const { user } = useAuth();
  const { showToast } = useToast();
  const [form, setForm] = useState(() => ({ ...emptyContactForm(), owner_id: user?.id || '' }));
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [accounts, setAccounts] = useState([]);
  const [users, setUsers] = useState([]);
  const { emailError, checking: checkingEmail } = useEmailFieldError(form.email);

  useEffect(() => {
    fetchAccountLookups().then(setAccounts).catch(() => setAccounts([]));
    fetchUsers().then(setUsers).catch(() => setUsers([]));
  }, []);

  const set = (field) => (e) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setForm((f) => ({ ...f, [field]: value }));
    setErrors((er) => ({ ...er, [field]: null }));
  };

  const copyMailingToOther = () => {
    setForm(f => ({
      ...f,
      other_flat: f.mailing_flat,
      other_street: f.mailing_street,
      other_city: f.mailing_city,
      other_state: f.mailing_state,
      other_country: f.mailing_country,
      other_zip: f.mailing_zip,
      other_lat: f.mailing_lat,
      other_lng: f.mailing_lng,
    }));
  };

  const handleSave = async () => {
    const accountOk = !!(form.account_id || String(form.account_name || '').trim());
    const errs = validateRequired({
      first_name: 'First Name',
      last_name: 'Last Name',
      email: 'Email',
    }, form);
    if (!accountOk) errs.account_id = 'Account Name is required';
    const emailErr = validateEmail(form.email);
    if (emailErr) errs.email = emailErr;
    if (form.phone) {
      const phoneErr = validatePhone(form.phone);
      if (phoneErr) errs.phone = phoneErr;
    }
    if (!errs.email && form.email) {
      const uniqueErr = emailError || await validateEmailUnique(form.email);
      if (uniqueErr) errs.email = uniqueErr;
    }
    setErrors(errs);
    if (Object.keys(errs).length) {
      showToast(errs.email?.includes('already exists') ? errs.email : 'Please fill in all required fields before saving.');
      return;
    }
    setSaving(true);
    try {
      const accountId = await resolveContactAccountId({
        account_id: form.account_id,
        account_name: form.account_name,
        accounts,
        phone: form.phone,
        mobile: form.mobile,
        owner_id: form.owner_id || user?.id,
      });
      const created = await contactsApi.createContact({ ...form, account_id: accountId });
      showToast('Contact saved', 'success');
      router.push(created?.id ? `/contacts/${created.id}` : '/contacts');
    } catch (err) {
      showToast(getApiError(err) || err.message);
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

        <div className="flex items-center justify-between mb-6">
          <h1 className="text-lg font-semibold text-zoho-text">Create Contact</h1>
          <div className="flex gap-2">
            <Link href="/contacts" className="btn-secondary">Cancel</Link>
            <button type="button" onClick={handleSave} disabled={saving || checkingEmail || !!emailError} className="btn-primary">
              {saving ? 'Saving…' : 'Save Contact'}
            </button>
          </div>
        </div>

        <div className="card p-6 space-y-0">

          {/* ── Contact Information ── */}
          <SectionTitle>Contact Information</SectionTitle>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">

            <FormField label="Contact Owner" name="owner_id">
              <select className="input" value={form.owner_id} onChange={set('owner_id')}>
                <option value="">—None—</option>
                {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </FormField>

            {/* empty cell to align grid */}
            <div />

            <FormField label="First Name" required error={errors.first_name} name="first_name">
              <div className="flex gap-2">
                <select className="input w-24 shrink-0" value={form.salutation} onChange={set('salutation')}>
                  <option value="">—None—</option>
                  {SALUTATIONS.map(s => <option key={s}>{s}</option>)}
                </select>
                <input className={inputClass(errors.first_name)} placeholder="First Name" value={form.first_name} onChange={set('first_name')} />
              </div>
            </FormField>

            <FormField label="Last Name" required error={errors.last_name} name="last_name">
              <input className={inputClass(errors.last_name)} value={form.last_name} onChange={set('last_name')} />
            </FormField>

            <FormField label="Email" required error={errors.email || emailError} name="email">
              <div>
                <input className={inputClass(errors.email || emailError)} type="email" value={form.email} onChange={set('email')} />
                {checkingEmail && !(errors.email || emailError) && (
                  <p className="text-xs text-zoho-muted mt-1">Checking availability…</p>
                )}
              </div>
            </FormField>

            <FormField label="Account Name" required error={errors.account_id} name="account_id">
              <AccountNameCombobox
                options={accounts}
                valueId={form.account_id}
                valueLabel={form.account_name}
                error={errors.account_id}
                onChange={({ account_id, account_name }) => {
                  setForm((f) => ({ ...f, account_id, account_name }));
                  setErrors((er) => ({ ...er, account_id: null }));
                }}
              />
            </FormField>

            <FormField label="Phone" error={errors.phone} name="phone">
              <input className={inputClass(errors.phone)} value={form.phone} onChange={set('phone')} />
            </FormField>

            <FormField label="Other Phone" name="other_phone">
              <input className="input" value={form.other_phone} onChange={set('other_phone')} />
            </FormField>

            <FormField label="Mobile" name="mobile">
              <input className="input" value={form.mobile} onChange={set('mobile')} />
            </FormField>

            <FormField label="Assistant" name="assistant">
              <input className="input" value={form.assistant} onChange={set('assistant')} />
            </FormField>

            <FormField label="Lead Source" name="lead_source">
              <select className="input" value={form.lead_source} onChange={set('lead_source')}>
                <option value="">—None—</option>
                {LEAD_SOURCES.map(s => <option key={s}>{s}</option>)}
              </select>
            </FormField>

            <FormField label="Designation" name="title">
              <input className="input" value={form.title} onChange={set('title')} />
            </FormField>

            <FormField label="Department" name="department">
              <input className="input" value={form.department} onChange={set('department')} />
            </FormField>

            <FormField label="Home Phone" name="home_phone">
              <input className="input" value={form.home_phone} onChange={set('home_phone')} />
            </FormField>

            <FormField label="Fax" name="fax">
              <input className="input" value={form.fax} onChange={set('fax')} />
            </FormField>

            <FormField label="Date of Birth" name="date_of_birth">
              <input className="input" type="date" value={form.date_of_birth} onChange={set('date_of_birth')} />
            </FormField>

            <FormField label="Asst Phone" name="asst_phone">
              <input className="input" value={form.asst_phone} onChange={set('asst_phone')} />
            </FormField>

            <div className="flex items-center gap-2 pt-1">
              <input id="email_opt_out" type="checkbox" className="w-4 h-4 rounded border-gray-300 text-brand-600 cursor-pointer"
                checked={!!form.email_opt_out} onChange={set('email_opt_out')} />
              <label htmlFor="email_opt_out" className="text-sm text-zoho-text cursor-pointer select-none">Email Opt Out</label>
            </div>

            <FormField label="LinkedIn" name="skype_id">
              <input className="input" type="url" placeholder="https://linkedin.com/in/…" value={form.skype_id} onChange={set('skype_id')} />
            </FormField>

            <FormField label="Secondary Email" name="secondary_email">
              <input className="input" type="email" value={form.secondary_email} onChange={set('secondary_email')} />
            </FormField>

            <FormField label="Twitter" name="twitter">
              <div className="flex items-center gap-1">
                <span className="text-sm text-zoho-muted">@</span>
                <input className="input flex-1" placeholder="handle" value={form.twitter} onChange={set('twitter')} />
              </div>
            </FormField>

            <FormField label="Website" name="website">
              <input className="input" type="url" placeholder="https://" value={form.website} onChange={set('website')} />
            </FormField>

          </div>

          {/* ── Address Information ── */}
          <SectionTitle>Address Information</SectionTitle>
          <div className="flex flex-col sm:flex-row gap-8 sm:gap-x-12 sm:gap-y-8 pt-1">
            <AddressBlock prefix="mailing" label="Mailing Address" form={form} set={set} />
            <AddressBlock prefix="other" label="Other Address" form={form} set={set} copyFrom={copyMailingToOther} />
          </div>

          {/* ── Description ── */}
          <SectionTitle>Description Information</SectionTitle>
          <FormField label="Description" name="description">
            <textarea className="input min-h-[100px] resize-y" placeholder="Add a description…"
              value={form.description} onChange={set('description')} />
          </FormField>

        </div>

        <div className="flex gap-2 justify-end pt-4">
          <Link href="/contacts" className="btn-secondary">Cancel</Link>
          <button type="button" onClick={handleSave} disabled={saving} className="btn-primary">
            {saving ? 'Saving…' : 'Save Contact'}
          </button>
        </div>
      </div>
    </CRMLayout>
  );
}
