import {
  expandSelectionId,
  buildSelectionLookup,
  isSelectionIdSelected,
} from '../selectionIdHelpers.js';

describe('selectionIdHelpers', () => {
  it('expands entity-prefixed ids to include the bare UUID', () => {
    expect(expandSelectionId('contact:abc-123')).toEqual(['contact:abc-123', 'abc-123']);
    expect(expandSelectionId('abc-123')).toEqual(['abc-123']);
  });

  it('matches bare UUID selection against prefixed row ids and vice versa', () => {
    const fromPrefixed = buildSelectionLookup(['contact:abc-123', 'lead:def-456']);
    expect(isSelectionIdSelected(fromPrefixed, 'abc-123')).toBe(true);
    expect(isSelectionIdSelected(fromPrefixed, 'contact:abc-123')).toBe(true);
    expect(isSelectionIdSelected(fromPrefixed, 'lead:def-456')).toBe(true);
    expect(isSelectionIdSelected(fromPrefixed, 'def-456')).toBe(true);
    expect(isSelectionIdSelected(fromPrefixed, 'other')).toBe(false);

    const fromBare = buildSelectionLookup(['abc-123']);
    expect(isSelectionIdSelected(fromBare, 'contact:abc-123')).toBe(true);
    expect(isSelectionIdSelected(fromBare, 'abc-123')).toBe(true);
  });
});
