'use client';
import CreatePipelineLeadForm from './CreatePipelineLeadForm.js';
import * as leadsApi from '../../lib/services/leads.js';
import { PIPELINE_QUALIFIED, PROPOSAL_SOURCE } from '../../lib/pipelineHelpers.js';

export default function CreateProposalForm() {
  return (
    <CreatePipelineLeadForm
      listPath="/proposals"
      listLabel="Proposals"
      title="Create Proposal"
      saveLabel="Save Proposal"
      successToast="Proposal created"
      emptyFormDefaults={{ lead_status: PIPELINE_QUALIFIED, source: PROPOSAL_SOURCE, deal_status: 'active_proposal' }}
      createFn={leadsApi.createProposal}
      showLeadSource={false}
      showProposalFields
    />
  );
}
