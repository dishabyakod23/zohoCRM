'use client';
import PipelineLeadDetail from '../../../components/leads/PipelineLeadDetail.js';
import { PIPELINE_RAW } from '../../../lib/pipelineHelpers.js';

export default function RawLeadDetailPage() {
  return <PipelineLeadDetail stage={PIPELINE_RAW} />;
}
