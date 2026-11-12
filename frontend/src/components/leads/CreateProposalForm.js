'use client';
import { useEffect, useState } from 'react';
import CreatePipelineLeadForm from './CreatePipelineLeadForm.js';
import * as leadsApi from '../../lib/services/leads.js';
import { useToast } from '../ui/Toast.js';
import { PIPELINE_PROPOSAL, PROPOSAL_DEFAULT_LEAD_STATUS, proposalClientDetails } from '../../lib/pipelineHelpers.js';

export default function CreateProposalForm() {
  const { showToast } = useToast();
  const [prefill, setPrefill] = useState(null);

  // "Add Proposal" on a client opens this form with ?from=<proposal id> to copy the client details.
  useEffect(() => {
    const fromId = new URLSearchParams(window.location.search).get('from');
    if (!fromId) return;
    leadsApi.getLead(fromId)
      .then((lead) => {
        const { lead_status, status, lost_reason, ...client } = proposalClientDetails(lead);
        setPrefill(client);
      })
      .catch(() => showToast('Could not load the client details'));
  }, [showToast]);

  return (
    <CreatePipelineLeadForm
      listPath="/proposals"
      listLabel="Proposals"
      title={prefill ? `Add Proposal for ${prefill.company || `${prefill.first_name || ''} ${prefill.last_name || ''}`.trim()}` : 'Create Proposal'}
      saveLabel="Save Proposal"
      successToast="Proposal created"
      emptyFormDefaults={{
        lead_status: PROPOSAL_DEFAULT_LEAD_STATUS,
        deal_status: 'active_proposal',
        pipeline_stage: PIPELINE_PROPOSAL,
      }}
      createFn={leadsApi.createProposal}
      showLeadStatus
      showLeadSource
      showProposalFields
      prefill={prefill}
    />
  );
}
