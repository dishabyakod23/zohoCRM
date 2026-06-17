'use client';
import PipelineLeadDetail from '../../../components/leads/PipelineLeadDetail.js';
import { PIPELINE_QUALIFIED } from '../../../lib/pipelineHelpers.js';

export default function QualifiedLeadDetailPage() {
  return <PipelineLeadDetail stage={PIPELINE_QUALIFIED} />;
}
