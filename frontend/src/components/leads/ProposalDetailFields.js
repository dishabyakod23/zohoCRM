'use client';
import FormField from '../forms/FormField.js';
import CurrencyAmountInput from '../forms/CurrencyAmountInput.js';
import { PROPOSAL_DEAL_STATUSES, PROPOSAL_TYPES } from '../../lib/pipelineHelpers.js';

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

/** Proposal-specific inputs, repeated once per proposal when creating or editing proposals. */
export default function ProposalDetailFields({ values, currency, onChange, onCurrencyChange, namePrefix = '' }) {
  const change = (field) => (e) => onChange(field, e.target.value);
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
      <div className="sm:col-span-2">
        <FormField label="Proposal Name" name={`${namePrefix}proposal_name`}>
          <input
            className="input"
            type="text"
            maxLength={200}
            value={values.proposal_name ?? ''}
            onChange={change('proposal_name')}
            placeholder="e.g. Website revamp"
          />
        </FormField>
      </div>
      <FormField label="Proposal Date" name={`${namePrefix}proposal_date`}>
        <input className="input" type="date" value={values.proposal_date?.slice?.(0, 10) || values.proposal_date || ''} onChange={change('proposal_date')} />
      </FormField>
      <FormField label="Size of the Deal" name={`${namePrefix}deal_size`}>
        <CurrencyAmountInput
          amount={values.deal_size}
          currency={currency}
          onAmountChange={change('deal_size')}
          onCurrencyChange={onCurrencyChange}
        />
      </FormField>
      <FormField label="Closure Date" name={`${namePrefix}closure_date`}>
        <input className="input" type="date" value={values.closure_date?.slice?.(0, 10) || values.closure_date || ''} onChange={change('closure_date')} />
      </FormField>
      <FormField label="Deal Status" name={`${namePrefix}deal_status`}>
        {noneSelect(values.deal_status, change('deal_status'), PROPOSAL_DEAL_STATUSES)}
      </FormField>
      <FormField label="Proposal Type" name={`${namePrefix}proposal_type`}>
        {noneSelect(values.proposal_type, change('proposal_type'), PROPOSAL_TYPES)}
      </FormField>
      <FormField label="AMC / IT Support" name={`${namePrefix}amc_it_support`}>
        <CurrencyAmountInput
          amount={values.amc_it_support}
          currency={values.amc_currency || currency}
          onAmountChange={(e) => {
            const value = e.target.value;
            if (value !== '' && !/^\d*\.?\d*$/.test(value)) return;
            onChange('amc_it_support', value);
          }}
          onCurrencyChange={change('amc_currency')}
          placeholder="0"
        />
      </FormField>
      <div className="sm:col-span-2">
        <FormField label="Proposal Description" name={`${namePrefix}proposal_description`}>
          <textarea
            className="input min-h-[80px] resize-y"
            value={values.proposal_description ?? ''}
            onChange={change('proposal_description')}
            placeholder="What this proposal covers, e.g. project scope"
          />
        </FormField>
      </div>
    </div>
  );
}
