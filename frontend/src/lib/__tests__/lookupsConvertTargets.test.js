import {
  remapPipelineConvertTargetLabels,
  filterPipelineConvertTargets,
} from '../services/lookups.js';

describe('remapPipelineConvertTargetLabels', () => {
  it('maps Raw Lead / Raw Prospect labels to Cold Lead', () => {
    const options = remapPipelineConvertTargetLabels([
      { value: 'raw_prospect', label: 'Raw Prospect' },
      { value: 'raw_lead', label: 'Raw Lead' },
    ]);
    expect(options.map((o) => o.label)).toEqual(['Cold Lead', 'Cold Lead']);
  });

  it('maps exact Lead label to Warm Lead without touching Qualified Lead', () => {
    const options = remapPipelineConvertTargetLabels([
      { value: 'contacted', label: 'Lead' },
      { value: 'qualified_lead', label: 'Qualified Lead' },
      { value: 'proposal', label: 'Proposal' },
    ]);
    expect(options.find((o) => o.value === 'contacted').label).toBe('Warm Lead');
    expect(options.find((o) => o.value === 'qualified_lead').label).toBe('Qualified Lead');
    expect(options.find((o) => o.value === 'proposal').label).toBe('Proposal');
  });

  it('remaps common value-based labels', () => {
    const options = remapPipelineConvertTargetLabels([
      { value: 'cold_lead', label: 'Cold' },
      { value: 'warm_lead', label: 'Warm' },
    ]);
    expect(options[0].label).toBe('Cold Lead');
    expect(options[1].label).toBe('Warm Lead');
  });
});

describe('filterPipelineConvertTargets', () => {
  it('removes Deal targets', () => {
    expect(filterPipelineConvertTargets([
      { value: 'deal', label: 'Deal' },
      { value: 'proposal', label: 'Proposal' },
    ])).toEqual([{ value: 'proposal', label: 'Proposal' }]);
  });
});
