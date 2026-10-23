'use client';
import { Suspense } from 'react';
import PipelineLeadList from '../../components/leads/PipelineLeadList.js';
import { PIPELINE_PROPOSAL } from '../../lib/pipelineHelpers.js';

export default function ProposalsPage() {
  return (
    <Suspense fallback={null}>
      <PipelineLeadList
        stage={PIPELINE_PROPOSAL}
        description="Leads in the proposal stage of the sales pipeline."
      />
    </Suspense>
  );
}
