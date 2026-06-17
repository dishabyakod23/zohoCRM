'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowPathIcon, ChevronDownIcon } from '@heroicons/react/24/outline';
import Modal from '../ui/Modal.js';
import ConfirmDialog from '../ui/ConfirmDialog.js';
import { useToast } from '../ui/Toast.js';
import { getApiError } from '../../lib/api.js';
import * as leadsApi from '../../lib/services/leads.js';
import { fetchDealStages } from '../../lib/services/lookups.js';
import { FALLBACK_DEAL_STAGES } from '../../lib/dealHelpers.js';
import {
  CONVERT_TYPE, getConvertOptions, getConvertRedirectPath,
} from '../../lib/pipelineHelpers.js';

export default function LeadConvertMenu({
  stage,
  leadId,
  leadName = 'this record',
  canEdit = false,
  isAdmin = false,
  isConverted = false,
}) {
  const router = useRouter();
  const { showToast } = useToast();
  const menuRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [pendingOption, setPendingOption] = useState(null);
  const [converting, setConverting] = useState(false);
  const [accountModalOpen, setAccountModalOpen] = useState(false);
  const [stageOptions, setStageOptions] = useState(FALLBACK_DEAL_STAGES);
  const [convertForm, setConvertForm] = useState({
    create_deal: false, deal_name: '', close_date: '', stage_value: 'qualification', amount: '',
  });

  const options = getConvertOptions(stage, { isAdmin });

  useEffect(() => {
    fetchDealStages().then(setStageOptions).catch(() => setStageOptions(FALLBACK_DEAL_STAGES));
  }, []);

  useEffect(() => {
    const onClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  if (!canEdit || isConverted || options.length === 0) return null;

  const runStageConvert = async (option) => {
    setConverting(true);
    try {
      await leadsApi.advanceLeadStage(leadId, option.target, {
        proposal: option.proposal,
        clearProposal: option.clearProposal,
      });
      showToast(`Converted to ${option.label}`, 'success');
      setPendingOption(null);
      router.push(getConvertRedirectPath(option.target, leadId));
    } catch (err) {
      showToast(getApiError(err));
    } finally {
      setConverting(false);
    }
  };

  const handleSelect = (option) => {
    setOpen(false);
    if (option.disabled) return;
    if (option.type === CONVERT_TYPE.ACCOUNT) {
      setAccountModalOpen(true);
      return;
    }
    setPendingOption(option);
  };

  const handleAccountConvert = async () => {
    try {
      const result = await leadsApi.convertLead(leadId, convertForm);
      showToast('Converted to Account', 'success');
      setAccountModalOpen(false);
      if (result.deal?.id) router.push(`/deals/${result.deal.id}`);
      else if (result.account?.id) router.push(`/accounts/${result.account.id}`);
    } catch (err) {
      showToast(getApiError(err));
    }
  };

  return (
    <>
      <div className="relative" ref={menuRef}>
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="btn-primary text-xs flex items-center gap-1.5"
        >
          <ArrowPathIcon className="w-4 h-4" />
          Convert
          <ChevronDownIcon className={`w-3.5 h-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>
        {open && (
          <div className="absolute right-0 top-full mt-1 bg-white border border-zoho-border rounded-xl shadow-card-hover py-1 w-48 z-40">
            {options.map((option) => (
              <button
                key={option.id}
                type="button"
                disabled={option.disabled}
                onClick={() => handleSelect(option)}
                className={`w-full text-left px-3 py-2 text-sm ${
                  option.disabled
                    ? 'text-zoho-muted/50 cursor-not-allowed'
                    : 'hover:bg-brand-50 text-zoho-text'
                }`}
                title={option.disabled && option.adminOnly ? 'Admin only' : undefined}
              >
                {option.label}
                {option.adminOnly && !isAdmin && (
                  <span className="block text-[10px] text-zoho-muted">Admin only</span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      <ConfirmDialog
        open={!!pendingOption}
        message={`Convert ${leadName} to ${pendingOption?.label}?`}
        confirmLabel={converting ? 'Converting...' : `Convert to ${pendingOption?.label}`}
        onConfirm={() => runStageConvert(pendingOption)}
        onCancel={() => setPendingOption(null)}
      />

      {accountModalOpen && (
        <Modal title="Convert to Account" onClose={() => setAccountModalOpen(false)}>
          <div className="space-y-3">
            <p className="text-sm text-zoho-muted">Account and Contact will be created from lead data.</p>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={convertForm.create_deal}
                onChange={(e) => setConvertForm((f) => ({ ...f, create_deal: e.target.checked }))}
              />
              Create a new Deal for this Account
            </label>
            {convertForm.create_deal && (
              <>
                <input className="input" placeholder="Deal name" value={convertForm.deal_name} onChange={(e) => setConvertForm((f) => ({ ...f, deal_name: e.target.value }))} />
                <input className="input" type="number" placeholder="Amount" value={convertForm.amount} onChange={(e) => setConvertForm((f) => ({ ...f, amount: e.target.value }))} />
                <input className="input" type="date" value={convertForm.close_date} onChange={(e) => setConvertForm((f) => ({ ...f, close_date: e.target.value }))} />
                <select className="input" value={convertForm.stage_value} onChange={(e) => setConvertForm((f) => ({ ...f, stage_value: e.target.value }))}>
                  {stageOptions.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </>
            )}
            <div className="flex gap-2 justify-end">
              <button type="button" onClick={() => setAccountModalOpen(false)} className="btn-secondary">Cancel</button>
              <button type="button" onClick={handleAccountConvert} className="btn-primary">Convert</button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
