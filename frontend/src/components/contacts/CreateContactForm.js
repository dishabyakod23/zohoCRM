'use client';
import { useEffect, useRef, useState } from 'react';
import AppLink from '../ui/AppLink.js';
import CRMLayout from '../layout/CRMLayout.js';
import FormField, { inputClass } from '../forms/FormField.js';
import { useAuth } from '../../hooks/useAuth.js';
import { useToast } from '../ui/Toast.js';
import { getApiError } from '../../lib/api.js';
import { SALUTATIONS } from '../../lib/constants.js';
import { AddressCountryField, AddressStateField } from '../forms/AddressCountryStateFields.js';
import { nextStateForCountry } from '../../lib/addressRegions.js';
import { validateRequired, validateEmail, validatePhone } from '../../lib/validators.js';
import { validateEmailUnique } from '../../lib/emailHelpers.js';
import { useEmailFieldError } from '../../hooks/useEmailUniqueValidation.js';
import * as contactsApi from '../../lib/services/contacts.js';
import { navigateToRecord } from '../../lib/recordNavigation.js';
import {
  fetchCompanyLookups,
  fetchUsers,
  fetchLeadStatuses,
  fetchLeadSources,
  fetchLostReasons,
  FALLBACK_LEAD_STATUSES,
} from '../../lib/services/lookups.js';
import { outreachLeadStatusOptions } from '../../lib/pipelineHelpers.js';
import { isLostLeadStatus } from '../../lib/statusHelpers.js';
import AccountNameCombobox from '../forms/AccountNameCombobox.js';
import CampaignSelect from '../forms/CampaignSelect.js';
import { resolveContactCompanyFields } from '../../lib/resolveContactAccount.js';
import { afterRecordSave, resolveOrCreateCampaignId } from '../../lib/campaignRecordHelpers.js';

export function emptyContactForm() {
  return {
    salutation: '', first_name: '', last_name: '', account_id: '', account_name: '',
    title: '', department: '', lead_source: '', lead_status: '', lost_reason: '', owner_id: '', campaign_id: '', campaign_name: '',
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

function AddressBlock({ prefix, label, form, set, setForm, copyFrom }) {
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
        <AddressCountryField
          name={`${prefix}_country`}
          value={form[`${prefix}_country`]}
          onChange={(country) => setForm((f) => ({
            ...f,
            [`${prefix}_country`]: country,
            [`${prefix}_state`]: nextStateForCountry(country, f[`${prefix}_state`]),
          }))}
        />
        <FormField label="Flat / House No. / Building / Apartment Name" name={`${prefix}_flat`}>
          <input className="input" value={form[`${prefix}_flat`]} onChange={set(`${prefix}_flat`)} />
        </FormField>
        <FormField label="Street Address" name={`${prefix}_street`}>
          <input className="input" value={form[`${prefix}_street`]} onChange={set(`${prefix}_street`)} />
        </FormField>
        <FormField label="City" name={`${prefix}_city`}>
          <input className="input" value={form[`${prefix}_city`]} onChange={set(`${prefix}_city`)} />
        </FormField>
        <AddressStateField
          name={`${prefix}_state`}
          country={form[`${prefix}_country`]}
          value={form[`${prefix}_state`]}
          onChange={(state) => setForm((f) => ({ ...f, [`${prefix}_state`]: state }))}
        />
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
  const { user } = useAuth();
  const { showToast } = useToast();
  const [form, setForm] = useState(() => ({ ...emptyContactForm(), owner_id: user?.id || '' }));
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [accounts, setAccounts] = useState([]);
  const [users, setUsers] = useState([]);
  const [leadStatusOptions, setLeadStatusOptions] = useState(() => outreachLeadStatusOptions(FALLBACK_LEAD_STATUSES));
  const [leadSourceOptions, setLeadSourceOptions] = useState([]);
  const [lostReasonOptions, setLostReasonOptions] = useState([]);
  const { emailError, checking: checkingEmail } = useEmailFieldError(form.email);
  const savingRef = useRef(false);

  useEffect(() => {
    fetchCompanyLookups().then(setAccounts).catch(() => setAccounts([]));
    fetchUsers().then(setUsers).catch(() => setUsers([]));
    fetchLeadStatuses()
      .then((options) => setLeadStatusOptions(outreachLeadStatusOptions(options)))
      .catch(() => setLeadStatusOptions(outreachLeadStatusOptions(FALLBACK_LEAD_STATUSES)));
    fetchLeadSources().then(setLeadSourceOptions).catch(() => setLeadSourceOptions([]));
    fetchLostReasons().then(setLostReasonOptions).catch(() => setLostReasonOptions([]));
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
    // Guard set synchronously (before any await) so a rapid double-click or a slow
    // in-flight email-uniqueness check can't start a second, concurrent submission.
    if (savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    try {
      const accountOk = !!(form.account_id || String(form.account_name || '').trim());
      const errs = validateRequired({
        first_name: 'First Name',
        last_name: 'Last Name',
        email: 'Email',
      }, form);
      if (!accountOk) errs.account_id = 'Company name is required';
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
      if (isLostLeadStatus(form.lead_status) && !form.lost_reason) {
        errs.lost_reason = 'Select a lost reason.';
      }
      setErrors(errs);
      if (Object.keys(errs).length) {
        showToast(errs.email?.includes('already exists') ? errs.email : 'Please fill in all required fields before saving.');
        return;
      }
      const { company_id, company_name, account_id } = await resolveContactCompanyFields({
        account_id: form.account_id,
        account_name: form.account_name,
        companies: accounts,
        phone: form.phone,
        mobile: form.mobile,
        owner_id: form.owner_id || user?.id,
      });
      const { account_id: _legacyAccountId, account_name: _legacyAccountName, ...contactFields } = form;
      const created = await contactsApi.createContact({
        ...contactFields,
        company_id,
        company_name,
        account_id,
      });
      const campaignId = await resolveOrCreateCampaignId({
        campaign_id: form.campaign_id,
        campaign_name: form.campaign_name,
      });
      await afterRecordSave({ campaignId, memberType: 'contact', recordId: created?.id });
      showToast('Contact saved', 'success');
      navigateToRecord(created?.id ? `/contacts/${created.id}` : '/contacts');
    } catch (err) {
      showToast(getApiError(err) || err.message);
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  return (
    <CRMLayout>
      <div className="p-6 max-w-5xl mx-auto w-full">
        <AppLink href="/contacts" className="inline-flex items-center gap-1.5 text-xs font-medium text-zoho-muted hover:text-brand-600 transition-colors mb-4">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          Contacts
        </AppLink>

        <div className="flex items-center justify-between mb-6">
          <h1 className="text-lg font-semibold text-zoho-text">Create Contact</h1>
          <div className="flex gap-2">
            <AppLink href="/contacts" className="btn-secondary">Cancel</AppLink>
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

            <div className="grid grid-cols-[auto_1fr] gap-2 items-start">
              <FormField label="Salutation" name="salutation">
                <select className="input w-24" value={form.salutation} onChange={set('salutation')}>
                  <option value="">—None—</option>
                  {SALUTATIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </FormField>
              <FormField label="First Name" required error={errors.first_name} name="first_name">
                <input className={inputClass(errors.first_name)} placeholder="First Name" value={form.first_name} onChange={set('first_name')} />
              </FormField>
            </div>

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

            <FormField label="Company Name" required error={errors.account_id} name="account_id">
              <AccountNameCombobox
                options={accounts}
                valueId={form.account_id}
                valueLabel={form.account_name}
                placeholder="Search or type company name"
                error={errors.account_id}
                onChange={({ account_id, account_name }) => {
                  setForm((f) => ({ ...f, account_id, account_name }));
                  setErrors((er) => ({ ...er, account_id: null }));
                }}
              />
            </FormField>

            <FormField label="Phone" error={errors.phone} name="phone">
              <input className={inputClass(errors.phone)} value={form.phone} onChange={set('phone')} maxLength={20} />
            </FormField>

            <FormField label="Other Phone" name="other_phone">
              <input className="input" value={form.other_phone} onChange={set('other_phone')} maxLength={20} />
            </FormField>

            <FormField label="Mobile" name="mobile">
              <input className="input" value={form.mobile} onChange={set('mobile')} maxLength={20} />
            </FormField>

            <FormField label="Assistant" name="assistant">
              <input className="input" value={form.assistant} onChange={set('assistant')} />
            </FormField>

            <FormField label="Lead Source" name="lead_source">
              <select className="input" value={form.lead_source} onChange={set('lead_source')}>
                <option value="">—None—</option>
                {leadSourceOptions.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </FormField>

            <FormField label="Lead Status" name="lead_status">
              <select
                className="input"
                value={form.lead_status}
                onChange={(e) => {
                  const value = e.target.value;
                  setForm((f) => ({
                    ...f,
                    lead_status: value,
                    ...(isLostLeadStatus(value) ? {} : { lost_reason: '' }),
                  }));
                  setErrors((er) => ({ ...er, lead_status: null, lost_reason: null }));
                }}
              >
                <option value="">—None—</option>
                {leadStatusOptions.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </FormField>

            {isLostLeadStatus(form.lead_status) && (
              <FormField label="Lost Reason" required error={errors.lost_reason} name="lost_reason">
                <select className={inputClass(errors.lost_reason)} value={form.lost_reason} onChange={set('lost_reason')}>
                  <option value="">Select lost reason</option>
                  {lostReasonOptions.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </FormField>
            )}

            <CampaignSelect
              value={form.campaign_id}
              valueLabel={form.campaign_name}
              onChange={({ campaign_id, campaign_name }) => setForm((f) => ({ ...f, campaign_id, campaign_name }))}
            />

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
            <AddressBlock prefix="mailing" label="Mailing Address" form={form} set={set} setForm={setForm} />
            <AddressBlock prefix="other" label="Other Address" form={form} set={set} setForm={setForm} copyFrom={copyMailingToOther} />
          </div>

          {/* ── Description ── */}
          <FormField label="Description" name="description">
            <textarea className="input min-h-[100px] resize-y" placeholder="Add a description…"
              value={form.description} onChange={set('description')} />
          </FormField>

        </div>

        <div className="flex gap-2 justify-end pt-4">
          <AppLink href="/contacts" className="btn-secondary">Cancel</AppLink>
          <button type="button" onClick={handleSave} disabled={saving || checkingEmail || !!emailError} className="btn-primary">
            {saving ? 'Saving…' : 'Save Contact'}
          </button>
        </div>
      </div>
    </CRMLayout>
  );
}
