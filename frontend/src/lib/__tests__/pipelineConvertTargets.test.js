import {
  CONTACT_CONVERT_TARGET,
  mergeContactConvertTarget,
  filterPipelineConvertTargets,
} from '../services/lookups.js';

describe('mergeContactConvertTarget', () => {
  it('adds Contact target for cold leads module', () => {
    const options = mergeContactConvertTarget(
      [{ value: 'contacted', label: 'Warm Lead' }],
      { moduleKey: 'raw-leads' },
    );
    expect(options[0]).toEqual(CONTACT_CONVERT_TARGET);
    expect(options).toHaveLength(2);
  });

  it('does not duplicate Contact when API already returns it', () => {
    const options = mergeContactConvertTarget(
      [{ value: 'contact', label: 'Contact' }, { value: 'contacted', label: 'Warm Lead' }],
      { moduleKey: 'raw-leads' },
    );
    expect(options.filter((o) => o.value === 'contact')).toHaveLength(1);
  });

  it('skips Contact on warm leads module', () => {
    const options = mergeContactConvertTarget(
      [{ value: 'qualified_lead', label: 'Qualified Lead' }],
      { moduleKey: 'leads' },
    );
    expect(options.some((o) => o.value === 'contact')).toBe(false);
  });
});

describe('filterPipelineConvertTargets', () => {
  it('removes deal targets', () => {
    const options = filterPipelineConvertTargets([
      { value: 'deal', label: 'Deal' },
      { value: 'account', label: 'Account' },
    ]);
    expect(options).toEqual([{ value: 'account', label: 'Account' }]);
  });
});
