'use client';
import { useEffect, useRef, useState } from 'react';
import AppLink from '../ui/AppLink.js';
import CRMLayout from '../layout/CRMLayout.js';
import FormField, { inputClass } from '../forms/FormField.js';
import { useToast } from '../ui/Toast.js';
import { getApiError } from '../../lib/api.js';
import { SALUTATIONS, RATINGS } from '../../lib/constants.js';
import IndustryField from '../forms/IndustryField.js';
import { AddressCountryField, AddressStateField } from '../forms/AddressCountryStateFields.js';
import { nextStateForCountry } from '../../lib/addressRegions.js';
import { PIPELINE_LEAD, outreachLeadStatusOptions } from '../../lib/pipelineHelpers.js';
import { validateRequired, validateEmail, validatePhone } from '../../lib/validators.js';
import { validateEmailUnique } from '../../lib/emailHelpers.js';
import { useEmailFieldError } from '../../hooks/useEmailUniqueValidation.js';
import * as leadsApi from '../../lib/services/leads.js';
import { navigateToRecord } from '../../lib/recordNavigation.js';
import { fetchLeadStatuses, fetchLeadSources, fetchLostReasons, FALLBACK_LEAD_STATUSES } from '../../lib/services/lookups.js';
import CurrencyAmountInput from '../forms/CurrencyAmountInput.js';
import CampaignSelect from '../forms/CampaignSelect.js';
import { DEFAULT_CURRENCY } from '../../lib/currencies.js';
import { afterRecordSave, resolveOrCreateCampaignId } from '../../lib/campaignRecordHelpers.js';
import { isLostLeadStatus } from '../../lib/statusHelpers.js';

export function emptyLeadForm() {
  return {
    salutation: '', first_name: '', last_name: '', email: '', phone: '', mobile: '',
    company: '', title: '', lead_status: PIPELINE_LEAD, lost_reason: '', source: '', industry: '',
    rating: '', website: '', annual_revenue: '', no_of_employees: '',
    proposal_amount: '',
    street: '', city: '', state: '', zip_code: '', country: 'India',
    description: '',
    campaign_id: '',
    campaign_name: '',
    currency: DEFAULT_CURRENCY,
  };
}

const REQUIRED = { first_name: 'First Name', last_name: 'Last Name', company: 'Company', email: 'Email', lead_status: 'Lead Status' };

function SectionTitle({ children }) {
  return <p className="text-xs font-semibold text-zoho-muted uppercase tracking-wider mb-5 mt-8 first:mt-0">{children}</p>;
}

export default function CreateLeadForm() {
  const { showToast } = useToast();
  const [form, setForm] = useState(emptyLeadForm);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [statusOptions, setStatusOptions] = useState(() => outreachLeadStatusOptions(FALLBACK_LEAD_STATUSES));
  const [sourceOptions, setSourceOptions] = useState([]);
  const [lostReasonOptions, setLostReasonOptions] = useState([]);
  const { emailError, checking: checkingEmail } = useEmailFieldError(form.email);
  const savingRef = useRef(false);

  useEffect(() => {
    fetchLeadStatuses()
      .then((options) => setStatusOptions(outreachLeadStatusOptions(options)))
      .catch(() => setStatusOptions(outreachLeadStatusOptions(FALLBACK_LEAD_STATUSES)));
    fetchLeadSources().then(setSourceOptions).catch(() => setSourceOptions([]));
    fetchLostReasons().then(setLostReasonOptions).catch(() => setLostReasonOptions([]));
  }, []);

  const set = (field) => (e) => {
    setForm((f) => ({ ...f, [field]: e.target.value }));
    setErrors((er) => ({ ...er, [field]: null }));
  };

  const setCountry = (country) => {
    setForm((f) => ({ ...f, country, state: nextStateForCountry(country, f.state) }));
    setErrors((er) => ({ ...er, country: null, state: null }));
  };

  const setStateValue = (state) => {
    setForm((f) => ({ ...f, state }));
    setErrors((er) => ({ ...er, state: null }));
  };

  const validate = async () => {
    const errs = validateRequired(REQUIRED, form);
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
      document.querySelector(`[data-field="${Object.keys(errs)[0]}"]`)?.scrollIntoView({ behavior: 'smooth' });
      return false;
    }
    return true;
  };

  const handleSave = async () => {
    // Guard set synchronously (before any await) so a rapid double-click or a slow
    // in-flight email-uniqueness check can't start a second, concurrent submission.
    if (savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    try {
      if (!(await validate())) return;
      const created = await leadsApi.createLead(form);
      const campaignId = await resolveOrCreateCampaignId({
        campaign_id: form.campaign_id,
        campaign_name: form.campaign_name,
      });
      await afterRecordSave({ campaignId, memberType: 'lead', recordId: created?.id });
      showToast('Lead saved', 'success');
      navigateToRecord(created?.id ? `/leads/${created.id}` : '/leads');
    } catch (err) {
      showToast(getApiError(err));
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  return (
    <CRMLayout>
      <div className="p-6 max-w-5xl mx-auto w-full">
        <AppLink href="/leads" className="inline-flex items-center gap-1.5 text-xs font-medium text-zoho-muted hover:text-brand-600 transition-colors mb-4">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          Warm Leads
        </AppLink>

        <h1 className="text-lg font-semibold text-zoho-text mb-6">Create Warm Lead</h1>

        <div className="card p-6">
          <SectionTitle>Lead Information</SectionTitle>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
            <div className="sm:col-span-2 grid grid-cols-[120px_1fr_1fr] gap-3">
              <FormField label="Salutation">
                <select className="input" value={form.salutation} onChange={set('salutation')}>
                  <option value="">--None--</option>
                  {SALUTATIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </FormField>
              <FormField label="First Name" required error={errors.first_name} name="first_name">
                <input className={inputClass(errors.first_name)} value={form.first_name} onChange={set('first_name')} />
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
              <select
                className={inputClass(errors.lead_status)}
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
                {statusOptions.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
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
            <FormField label="Lead Source">
              <select className="input" value={form.source} onChange={set('source')}>
                <option value="">--None--</option>
                {sourceOptions.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </FormField>
            <CampaignSelect
              value={form.campaign_id}
              valueLabel={form.campaign_name}
              onChange={({ campaign_id, campaign_name }) => setForm((f) => ({ ...f, campaign_id, campaign_name }))}
            />
            <IndustryField
              value={form.industry}
              onChange={(industry) => setForm((f) => ({ ...f, industry }))}
            />
            <FormField label="Rating">
              <select className="input" value={form.rating} onChange={set('rating')}>
                <option value="">--None--</option>
                {RATINGS.map((r) => <option key={r}>{r}</option>)}
              </select>
            </FormField>
            <FormField label="Annual Revenue" name="annual_revenue">
              <CurrencyAmountInput
                amount={form.annual_revenue}
                currency={form.currency}
                onAmountChange={set('annual_revenue')}
                onCurrencyChange={set('currency')}
              />
            </FormField>
            <FormField label="Proposal Amount" name="proposal_amount">
              <CurrencyAmountInput
                amount={form.proposal_amount}
                currency={form.currency}
                onAmountChange={set('proposal_amount')}
                onCurrencyChange={set('currency')}
              />
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
            <FormField label="Email" required error={errors.email || emailError} name="email">
              <div>
                <input className={inputClass(errors.email || emailError)} type="email" value={form.email} onChange={set('email')} />
                {checkingEmail && !(errors.email || emailError) && (
                  <p className="text-xs text-zoho-muted mt-1">Checking availability…</p>
                )}
              </div>
            </FormField>
            <FormField label="Phone" error={errors.phone} name="phone">
              <input className={inputClass(errors.phone)} value={form.phone} onChange={set('phone')} maxLength={20} />
            </FormField>
            <FormField label="Mobile">
              <input className="input" value={form.mobile} onChange={set('mobile')} maxLength={20} />
            </FormField>
          </div>

          <SectionTitle>Address Information</SectionTitle>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-5 mb-4">
            <div className="sm:col-span-2">
              <FormField label="Street">
                <input className="input" value={form.street} onChange={set('street')} />
              </FormField>
            </div>
            <FormField label="City">
              <input className="input" value={form.city} onChange={set('city')} />
            </FormField>
            <AddressCountryField value={form.country} onChange={setCountry} />
            <AddressStateField country={form.country} value={form.state} onChange={setStateValue} />
            <FormField label="Zip Code">
              <input className="input" value={form.zip_code} onChange={set('zip_code')} />
            </FormField>
          </div>

          <FormField label="Description" name="description">
            <textarea className="input min-h-[100px] resize-y" placeholder="Add a description..." value={form.description} onChange={set('description')} />
          </FormField>

          <div className="flex gap-2 justify-end pt-6 mt-4 border-t border-zoho-border">
            <AppLink href="/leads" className="btn-secondary">Cancel</AppLink>
            <button type="button" onClick={handleSave} disabled={saving || checkingEmail || !!emailError} className="btn-primary">
              {saving ? 'Saving...' : 'Save Warm Lead'}
            </button>
          </div>
        </div>
      </div>
    </CRMLayout>
  );
}
