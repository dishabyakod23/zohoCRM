'use client';
import CreatePipelineLeadForm from './CreatePipelineLeadForm.js';
import * as leadsApi from '../../lib/services/leads.js';
import { PIPELINE_QUALIFIED } from '../../lib/pipelineHelpers.js';

export default function CreateQualifiedLeadForm() {
  return (
    <CreatePipelineLeadForm
      listPath="/qualified-leads"
      listLabel="Qualified Leads"
      title="Create Qualified Lead"
      saveLabel="Save Qualified Lead"
      successToast="Qualified lead created"
      emptyFormDefaults={{ lead_status: PIPELINE_QUALIFIED, source: 'Manual Entry' }}
      createFn={leadsApi.createQualifiedLead}
    />
  );
}
