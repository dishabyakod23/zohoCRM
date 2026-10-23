'use client';
import { Suspense } from 'react';
import PipelineLeadList from '../../components/leads/PipelineLeadList.js';
import { PIPELINE_QUALIFIED } from '../../lib/pipelineHelpers.js';

export default function QualifiedLeadsPage() {
  return (
    <Suspense fallback={null}>
      <PipelineLeadList
        stage={PIPELINE_QUALIFIED}
        description="Leads that have been qualified and are ready for proposal preparation."
      />
    </Suspense>
  );
}
