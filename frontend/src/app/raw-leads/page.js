'use client';
import PipelineLeadList from '../../components/leads/PipelineLeadList.js';
import { PIPELINE_RAW } from '../../lib/pipelineHelpers.js';

export default function RawLeadsPage() {
  return (
    <PipelineLeadList
      stage={PIPELINE_RAW}
      description="Uploaded leads that have not been contacted yet. Admins can assign them to team members."
    />
  );
}
