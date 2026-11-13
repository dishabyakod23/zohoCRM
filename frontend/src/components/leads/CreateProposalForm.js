'use client';
import { useEffect, useState } from 'react';
import CreatePipelineLeadForm from './CreatePipelineLeadForm.js';
import * as leadsApi from '../../lib/services/leads.js';
import { useToast } from '../ui/Toast.js';
import { PIPELINE_PROPOSAL, PROPOSAL_DEFAULT_LEAD_STATUS, proposalClientDetails } from '../../lib/pipelineHelpers.js';
import { groupProposalVersions, nextProposalVersion, proposalRootId } from '../../lib/proposalVersions.js';

export default function CreateProposalForm() {
  const { showToast } = useToast();
  const [prefill, setPrefill] = useState(null);
  // Set when adding a revised version: { revision_of, proposal_version }.
  const [revision, setRevision] = useState(null);

  // "Add Proposal" on a client opens this form with ?from=<proposal id> to copy the client details.
  // "Add revised proposal" adds &revise=1: the new record becomes the next version of that proposal.
  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    const fromId = query.get('from');
    if (!fromId) return;
    const revising = query.get('revise') === '1';
    leadsApi.getLead(fromId)
      .then(async (lead) => {
        const { lead_status, status, lost_reason, ...client } = proposalClientDetails(lead);
        if (!revising) {
          setPrefill(client);
          return;
        }
        // The proposal fields start empty; only the client details and the proposal name carry over.
        setPrefill({ ...client, proposal_name: lead.proposal_name || '' });
        const root = proposalRootId(lead);
        const all = await leadsApi.listAllLeads({ pipeline_stage: PIPELINE_PROPOSAL })
          .then((res) => res.data || [])
          .catch(() => [lead]);
        const versions = groupProposalVersions(all).get(root) || [lead];
        setRevision({ revision_of: root, proposal_version: nextProposalVersion(versions) });
      })
      .catch(() => showToast('Could not load the client details'));
  }, [showToast]);

  const clientName = prefill
    ? prefill.company || `${prefill.first_name || ''} ${prefill.last_name || ''}`.trim()
    : '';
  const title = revision
    ? `Add Revised Proposal — Version ${revision.proposal_version}${clientName ? ` for ${clientName}` : ''}`
    : prefill ? `Add Proposal for ${clientName}` : 'Create Proposal';

  return (
    <CreatePipelineLeadForm
      listPath="/proposals"
      listLabel="Proposals"
      title={title}
      saveLabel={revision ? 'Save Revised Proposal' : 'Save Proposal'}
      successToast={revision ? `Version ${revision.proposal_version} added` : 'Proposal created'}
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
      extraPayload={revision}
      allowExtraProposals={!revision}
    />
  );
}
