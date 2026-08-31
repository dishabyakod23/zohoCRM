'use client';
import { useEffect, useRef, useState } from 'react';
import AppLink from '../ui/AppLink.js';
import CRMLayout from '../layout/CRMLayout.js';
import FormField, { inputClass } from '../forms/FormField.js';
import { useToast } from '../ui/Toast.js';
import { useAuth } from '../../hooks/useAuth.js';
import { usePermissions } from '../../hooks/usePermissions.js';
import { getApiError } from '../../lib/api.js';
import { validateRequired, validateEmail } from '../../lib/validators.js';
import { validateEmailUnique } from '../../lib/emailHelpers.js';
import { useEmailFieldError } from '../../hooks/useEmailUniqueValidation.js';
import { fetchUsers, fetchLeadStatuses, fetchLeadSources, fetchLostReasons, FALLBACK_LEAD_STATUSES } from '../../lib/services/lookups.js';
import { PROPOSAL_DEAL_STATUSES, PROPOSAL_TYPES, outreachLeadStatusOptions } from '../../lib/pipelineHelpers.js';
import { isLostLeadStatus } from '../../lib/statusHelpers.js';
import {
  SALUTATIONS, RATINGS,
} from '../../lib/constants.js';
import IndustryField from '../forms/IndustryField.js';
import { AddressCountryField, AddressStateField } from '../forms/AddressCountryStateFields.js';
import { nextStateForCountry } from '../../lib/addressRegions.js';
import CurrencyAmountInput from '../forms/CurrencyAmountInput.js';
import CampaignSelect from '../forms/CampaignSelect.js';
import { DEFAULT_CURRENCY } from '../../lib/currencies.js';
import { navigateToRecord } from '../../lib/recordNavigation.js';
import { afterRecordSave, resolveOrCreateCampaignId } from '../../lib/campaignRecordHelpers.js';

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
    proposal_date: '',
    deal_size: '',
    closure_date: '',
    deal_status: 'active_proposal',
    proposal_type: '',
    amc_it_support: '',
    amc_currency: DEFAULT_CURRENCY,
    email_opt_out: false,
    company: '',
    last_name: '',
    email: '',
    fax: '',
    website: '',
    lead_status: '',
    lost_reason: '',
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
    campaign_id: '',
    campaign_name: '',
    currency: DEFAULT_CURRENCY,
    ...defaults,
  };
}

const REQUIRED = { first_name: 'First Name', last_name: 'Last Name', company: 'Company', email: 'Email' };

function SectionTitle({ children }) {
  return <p className="text-xs font-semibold text-zoho-muted uppercase tracking-wider mb-5 mt-8 first:mt-0">{children}</p>;
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
  showProposalFields = false,
}) {
  const { showToast } = useToast();
  const { user } = useAuth();
  const { canAssignLeads } = usePermissions();
  const [form, setForm] = useState(() => emptyPipelineLeadForm(user?.id || '', emptyFormDefaults));
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [users, setUsers] = useState([]);
  const [statusOptions, setStatusOptions] = useState(FALLBACK_LEAD_STATUSES);
  const [sourceOptions, setSourceOptions] = useState([]);
  const [lostReasonOptions, setLostReasonOptions] = useState([]);
  const { emailError, checking: checkingEmail } = useEmailFieldError(form.email);
  const savingRef = useRef(false);

  useEffect(() => {
    if (user?.id) setForm((f) => ({ ...f, owner_id: f.owner_id || user.id }));
    Promise.all([fetchUsers(), fetchLeadStatuses(), fetchLeadSources(), fetchLostReasons()])
      .then(([u, s, sources, reasons]) => {
        setUsers(u);
        setStatusOptions(s);
        setSourceOptions(sources);
        setLostReasonOptions(reasons);
      })
      .catch(() => {});
  }, [user?.id]);

  const set = (field) => (e) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setForm((f) => ({ ...f, [field]: value }));
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

  const clearAddress = () => {
    setForm((f) => ({
      ...f,
      country: '', building: '', street: '', city: '', state: '', zip_code: '', latitude: '', longitude: '',
    }));
  };

  const validate = async () => {
    const errs = validateRequired(REQUIRED, form);
    const emailErr = validateEmail(form.email);
    if (emailErr) errs.email = emailErr;
    if (form.secondary_email) {
      const secErr = validateEmail(form.secondary_email);
      if (secErr) errs.secondary_email = secErr;
    }
    if (!errs.email && form.email) {
      const uniqueErr = emailError || await validateEmailUnique(form.email);
      if (uniqueErr) errs.email = uniqueErr;
    }
    if (showLeadStatus && isLostLeadStatus(form.lead_status) && !form.lost_reason) {
      errs.lost_reason = 'Select a lost reason.';
    }
    setErrors(errs);
    if (Object.keys(errs).length) {
      showToast(errs.email?.includes('already exists') ? errs.email : 'Please fill in required fields.');
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
      const created = await createFn(form, { currentUserId: user?.id });
      const campaignId = await resolveOrCreateCampaignId({
        campaign_id: form.campaign_id,
        campaign_name: form.campaign_name,
      });
      await afterRecordSave({ campaignId, memberType: 'lead', recordId: created?.id });
      showToast(successToast, 'success');
      navigateToRecord(created?.id ? `${listPath}/${created.id}` : listPath);
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
        <AppLink href={listPath} className="inline-flex items-center gap-1.5 text-xs font-medium text-zoho-muted hover:text-brand-600 transition-colors mb-4">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          {listLabel}
        </AppLink>

        <h1 className="text-lg font-semibold text-zoho-text mb-6">{title}</h1>

        <div className="card p-6">
          <SectionTitle>Lead Information</SectionTitle>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
            {canAssignLeads && (
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
            )}
            <div className="sm:col-span-2 grid grid-cols-1 sm:grid-cols-[120px_1fr_1fr] gap-3">
              <FormField label="Salutation">
                {noneSelect(form.salutation, set('salutation'), SALUTATIONS)}
              </FormField>
              <FormField label="First Name" required error={errors.first_name} name="first_name">
                <input className={inputClass(errors.first_name)} placeholder="First Name" value={form.first_name} onChange={set('first_name')} />
              </FormField>
              <FormField label="Last Name" required error={errors.last_name} name="last_name">
                <input className={inputClass(errors.last_name)} placeholder="Last Name" value={form.last_name} onChange={set('last_name')} />
              </FormField>
            </div>
            <FormField label="Title" name="title">
              <input className="input" value={form.title} onChange={set('title')} />
            </FormField>
            <FormField label="Email" required error={errors.email || emailError} name="email">
              <div>
                <input className={inputClass(errors.email || emailError)} type="email" value={form.email} onChange={set('email')} />
                {checkingEmail && !(errors.email || emailError) && (
                  <p className="text-xs text-zoho-muted mt-1">Checking availability…</p>
                )}
              </div>
            </FormField>
            <FormField label="Phone" name="phone">
              <input className="input" value={form.phone} onChange={set('phone')} />
            </FormField>
            <FormField label="Mobile" name="mobile">
              <input className="input" value={form.mobile} onChange={set('mobile')} />
            </FormField>
            {showLeadSource && (
              <FormField label="Lead Source" name="source">
                {noneSelect(form.source, set('source'), sourceOptions)}
              </FormField>
            )}
            <CampaignSelect
              value={form.campaign_id}
              valueLabel={form.campaign_name}
              onChange={({ campaign_id, campaign_name }) => setForm((f) => ({ ...f, campaign_id, campaign_name }))}
            />
            <IndustryField
              value={form.industry}
              onChange={(industry) => setForm((f) => ({ ...f, industry }))}
            />
            <FormField label="Annual Revenue" name="annual_revenue">
              <CurrencyAmountInput
                amount={form.annual_revenue}
                currency={form.currency}
                onAmountChange={set('annual_revenue')}
                onCurrencyChange={set('currency')}
              />
            </FormField>
            {!showProposalFields && (
              <FormField label="Proposal Amount" name="proposal_amount">
                <CurrencyAmountInput
                  amount={form.proposal_amount}
                  currency={form.currency}
                  onAmountChange={set('proposal_amount')}
                  onCurrencyChange={set('currency')}
                />
              </FormField>
            )}
            <FormField label="Email Opt Out" name="email_opt_out">
              <label className="flex items-center gap-2 text-sm h-10">
                <input type="checkbox" checked={form.email_opt_out} onChange={set('email_opt_out')} />
                Opt out of emails
              </label>
            </FormField>
            <FormField label="Company" required error={errors.company} name="company">
              <input className={inputClass(errors.company)} value={form.company} onChange={set('company')} />
            </FormField>
            <FormField label="Fax" name="fax">
              <input className="input" value={form.fax} onChange={set('fax')} />
            </FormField>
            <FormField label="Website" name="website">
              <input className="input" placeholder="https://" value={form.website} onChange={set('website')} />
            </FormField>
            {showLeadStatus && (
              <>
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
                    <option value="">--None--</option>
                    {outreachLeadStatusOptions(statusOptions).map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
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
              </>
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

          {showProposalFields && (
            <>
              <SectionTitle>Proposal Information</SectionTitle>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                <FormField label="Proposal Date" name="proposal_date">
                  <input className="input" type="date" value={form.proposal_date?.slice?.(0, 10) || form.proposal_date || ''} onChange={set('proposal_date')} />
                </FormField>
                <FormField label="Size of the Deal" name="deal_size">
                  <CurrencyAmountInput
                    amount={form.deal_size}
                    currency={form.currency}
                    onAmountChange={set('deal_size')}
                    onCurrencyChange={set('currency')}
                  />
                </FormField>
                <FormField label="Closure Date" name="closure_date">
                  <input className="input" type="date" value={form.closure_date?.slice?.(0, 10) || form.closure_date || ''} onChange={set('closure_date')} />
                </FormField>
                <FormField label="Deal Status" name="deal_status">
                  {noneSelect(form.deal_status, set('deal_status'), PROPOSAL_DEAL_STATUSES)}
                </FormField>
                <FormField label="Proposal Type" name="proposal_type">
                  {noneSelect(form.proposal_type, set('proposal_type'), PROPOSAL_TYPES)}
                </FormField>
                <FormField label="AMC / IT Support" name="amc_it_support">
                  <CurrencyAmountInput
                    amount={form.amc_it_support}
                    currency={form.amc_currency || form.currency}
                    onAmountChange={(e) => {
                      const value = e.target.value;
                      if (value !== '' && !/^\d*\.?\d*$/.test(value)) return;
                      setForm((f) => ({ ...f, amc_it_support: value }));
                    }}
                    onCurrencyChange={(e) => setForm((f) => ({ ...f, amc_currency: e.target.value }))}
                    placeholder="0"
                  />
                </FormField>
              </div>
            </>
          )}

          <SectionTitle>Address Information</SectionTitle>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-5 mb-2">
            <AddressCountryField value={form.country} onChange={setCountry} />
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
            <AddressStateField country={form.country} value={form.state} onChange={setStateValue} />
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

          <FormField label="Description" name="description">
            <textarea className="input min-h-[100px] resize-y" value={form.description} onChange={set('description')} />
          </FormField>

          <div className="flex gap-2 justify-end pt-6 mt-4 border-t border-zoho-border">
            <AppLink href={listPath} className="btn-secondary">Cancel</AppLink>
            <button type="button" onClick={handleSave} disabled={saving || checkingEmail || !!emailError} className="btn-primary">
              {saving ? 'Saving...' : saveLabel}
            </button>
          </div>
        </div>
      </div>
    </CRMLayout>
  );
}
