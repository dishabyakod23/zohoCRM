import { mergeLeadStatusOptions, isDndStatus, isDndRecord, ensureDndLeadStatusOption, pickRegisteredDndValue } from '../statusHelpers.js';

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

describe('DND lead status', () => {
  it('recognizes DND aliases', () => {
    expect(isDndStatus('dnd')).toBe(true);
    expect(isDndStatus('DND')).toBe(true);
    expect(isDndStatus('Do Not Disturb')).toBe(true);
    expect(isDndStatus('not_contacted')).toBe(false);
  });

  it('detects DND on contact and lead records', () => {
    expect(isDndRecord({ lead_status: 'dnd' })).toBe(true);
    expect(isDndRecord({ status: 'do_not_disturb' })).toBe(true);
    expect(isDndRecord({ lead_status: 'not_contacted' })).toBe(false);
  });

  it('injects DND into status dropdown options when missing', () => {
    const withDnd = ensureDndLeadStatusOption([{ value: 'not_contacted', label: 'Not Contacted' }]);
    expect(withDnd.some((o) => o.value === 'dnd' && o.label === 'DND')).toBe(true);
    const already = ensureDndLeadStatusOption([{ value: 'dnd', label: 'Do Not Disturb' }]);
    expect(already.filter((o) => o.value === 'dnd')).toHaveLength(1);
  });

  it('picks the registered DND lookup value', () => {
    expect(pickRegisteredDndValue([{ value: 'not_contacted', label: 'Not Contacted' }])).toBeNull();
    expect(pickRegisteredDndValue([{ value: 'do_not_disturb', label: 'DND' }])).toBe('do_not_disturb');
  });
});
