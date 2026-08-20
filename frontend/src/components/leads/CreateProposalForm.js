'use client';
import CreatePipelineLeadForm from './CreatePipelineLeadForm.js';
import * as leadsApi from '../../lib/services/leads.js';
import { PIPELINE_PROPOSAL, PROPOSAL_DEFAULT_LEAD_STATUS } from '../../lib/pipelineHelpers.js';

export default function CreateProposalForm() {
  return (
    <CreatePipelineLeadForm
      listPath="/proposals"
      listLabel="Proposals"
      title="Create Proposal"
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
    />
  );
}
