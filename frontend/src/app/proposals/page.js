'use client';
import PipelineLeadList from '../../components/leads/PipelineLeadList.js';
import { PIPELINE_PROPOSAL } from '../../lib/pipelineHelpers.js';

export default function ProposalsPage() {
  return (
    <PipelineLeadList
      stage={PIPELINE_PROPOSAL}
      description="Leads in the proposal stage of the sales pipeline."
    />
  );
}
