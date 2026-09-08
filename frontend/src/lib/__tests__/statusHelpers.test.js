import { mergeLeadStatusOptions } from '../statusHelpers.js';

describe('mergeLeadStatusOptions', () => {
  it('adds custom admin statuses missing from public lookups', () => {
    const lookups = [
      { value: 'follow_up_required', label: 'Follow-up Required' },
      { value: 'interested', label: 'Interested' },
    ];
    const admin = [
      { value: 'follow_up_required', label: 'Follow-up Required' },
      { value: 'hot_lead', label: 'Hot Lead' },
      { value: 'moved_to_next_step', label: 'Moved from cold lead' },
    ];
    expect(mergeLeadStatusOptions(lookups, admin).map((o) => o.value)).toEqual([
      'follow_up_required',
      'interested',
      'hot_lead',
      'moved_to_next_step',
    ]);
  });
});
