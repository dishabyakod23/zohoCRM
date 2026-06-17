'use client';
import PipelineLeadDetail from '../../../components/leads/PipelineLeadDetail.js';
import { PIPELINE_PROPOSAL } from '../../../lib/pipelineHelpers.js';

export default function ProposalDetailPage() {
  return <PipelineLeadDetail stage={PIPELINE_PROPOSAL} />;
}
