import { ownerName } from './recordHelpers.js';
import { DEFAULT_CURRENCY } from './currencies.js';
import { trimStringFields } from './formInput.js';

const STAGE_LABELS = {
  qualification: 'Qualification',
  needs_analysis: 'Needs Analysis',
  value_proposition: 'Value Proposition',
  identify_decision_makers: 'Id. Decision Makers',
  perception_analysis: 'Perception Analysis',
  proposal_price_quote: 'Proposal / Price Quote',
  negotiation_review: 'Negotiation / Review',
  closed_won: 'Closed Won',
  closed_lost: 'Closed Lost',
};

const LABEL_TO_STAGE = Object.fromEntries(Object.entries(STAGE_LABELS).map(([k, v]) => [v, k]));

export const FALLBACK_DEAL_STAGES = Object.entries(STAGE_LABELS).map(([value, label]) => ({ value, label }));

const SNAKE_CASE_RE = /^[a-z][a-z0-9_]*$/;

/** Normalize API stage (string or `{ value, label }`) to a plain code. */
export function dealStageCode(stage) {
  if (stage == null || stage === '') return '';
  if (typeof stage === 'object') {
    return String(stage.value ?? stage.key ?? stage.code ?? stage.label ?? '').trim();
  }
  return String(stage).trim();
}

export function dealStageLabel(stage, options = []) {
  const code = dealStageCode(stage);
  if (!code) return '—';
  const fromLookup = (options || []).find((o) => o.value === code || o.label === code);
  if (fromLookup) return fromLookup.label;
  return STAGE_LABELS[code] || code.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export function resolveDealStageForApi(stage) {
  const code = dealStageCode(stage);
  if (!code) return 'qualification';
  if (SNAKE_CASE_RE.test(code)) return code;
  return LABEL_TO_STAGE[code] || code.toLowerCase().replace(/ /g, '_');
}

export function normalizeDeal(deal, accountMap = {}, stageOptions = []) {
  if (!deal) return deal;
  const account = accountMap[deal.account_id];
  const resolvedName = deal.name || deal.deal_name;
  const resolvedCloseDate = deal.close_date || deal.closing_date;
  return {
    ...deal,
    name: resolvedName,
    deal_name: resolvedName,
    stage: dealStageLabel(deal.stage, stageOptions),
    stage_value: dealStageCode(deal.stage_value || deal.stage),
    close_date: resolvedCloseDate,
    closing_date: resolvedCloseDate,
    amount: deal.amount != null ? Number(deal.amount) : deal.amount,
    currency: deal.currency || DEFAULT_CURRENCY,
    account_name: account?.label || account?.name || deal.account_name,
    owner_name: ownerName(deal) || deal.owner_name,
  };
}

export function toDealPayload(form, { partial = false } = {}) {
  form = trimStringFields(form) || form;
  const payload = {
    deal_name: form.deal_name || form.name,
    account_id: form.account_id,
    amount: form.amount != null && form.amount !== '' ? Number(form.amount) : form.amount,
    closing_date: form.closing_date || form.close_date,
    stage: resolveDealStageForApi(form.stage_value || form.stage),
    probability: form.probability != null && form.probability !== '' ? Number(form.probability) : null,
    contact_id: form.contact_id || null,
    deal_type: form.deal_type || null,
    lead_source: form.lead_source || null,
    description: form.description || null,
    proposal_amount: form.proposal_amount || null,
    currency: form.currency || DEFAULT_CURRENCY,
    owner_id: form.owner_id || null,
  };
  if (partial) {
    return Object.fromEntries(Object.entries(payload).filter(([, v]) => v !== undefined && v !== null && v !== ''));
  }
  return payload;
}

export function toConvertPayload(form) {
  return {
    create_deal: !!form.create_deal,
    deal_name: form.deal_name || null,
    amount: form.amount ? Number(form.amount) : null,
    close_date: form.close_date || form.closing_date || null,
    stage: resolveDealStageForApi(form.stage_value || form.stage || 'qualification'),
  };
}
