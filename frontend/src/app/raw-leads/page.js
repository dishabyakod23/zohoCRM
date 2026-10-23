'use client';
import { Suspense } from 'react';
import PipelineLeadList from '../../components/leads/PipelineLeadList.js';
import { PIPELINE_RAW } from '../../lib/pipelineHelpers.js';

export default function RawLeadsPage() {
  return (
    <Suspense fallback={null}>
      <PipelineLeadList
        stage={PIPELINE_RAW}
        description="Cold leads that have not been contacted yet. Admins can assign them to team members."
      />
    </Suspense>
  );
}
