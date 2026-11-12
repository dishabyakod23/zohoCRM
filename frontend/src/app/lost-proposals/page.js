'use client';
import { Suspense } from 'react';
import PipelineLeadList from '../../components/leads/PipelineLeadList.js';
import { PIPELINE_PROPOSAL } from '../../lib/pipelineHelpers.js';

export default function LostProposalsPage() {
  return (
    <Suspense fallback={null}>
      <PipelineLeadList
        stage={PIPELINE_PROPOSAL}
        lostOnly
        description="Proposals marked as Deal Lost."
      />
    </Suspense>
  );
}
