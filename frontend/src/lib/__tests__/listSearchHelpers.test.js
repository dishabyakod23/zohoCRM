import {
  tokenizeSearchQuery,
  resolveListSearch,
  matchesSearchTokens,
  personSearchHaystack,
  filterRowsBySearchTokens,
} from '../listSearchHelpers.js';

describe('listSearchHelpers', () => {
  it('tokenizes multi-word queries', () => {
    expect(tokenizeSearchQuery('  Paul   Brook ')).toEqual(['paul', 'brook']);
  });

  it('uses the longest token for API narrowing on multi-word search', () => {
    const resolved = resolveListSearch('paul brook');
    expect(resolved.needsClientMatch).toBe(true);
    expect(resolved.apiSearch).toBe('brook');
    expect(resolved.tokens).toEqual(['paul', 'brook']);
  });

  it('passes single-word search through without client match', () => {
    const resolved = resolveListSearch('paul');
    expect(resolved.needsClientMatch).toBe(false);
    expect(resolved.apiSearch).toBe('paul');
  });

  it('matches full name across first_name + last_name', () => {
    const row = { first_name: 'Paul', last_name: 'Brook', email: 'paul@example.com' };
    expect(matchesSearchTokens(row, ['paul', 'brook'], personSearchHaystack)).toBe(true);
    expect(matchesSearchTokens(row, ['paul', 'smith'], personSearchHaystack)).toBe(false);
  });

  it('filters rows so every token must match the haystack', () => {
    const rows = [
      { first_name: 'Paul', last_name: 'Brook' },
      { first_name: 'Paul', last_name: 'Smith' },
      { first_name: 'Anna', last_name: 'Brook' },
    ];
    const filtered = filterRowsBySearchTokens(rows, 'paul brook');
    expect(filtered).toHaveLength(1);
    expect(filtered[0].last_name).toBe('Brook');
  });
});
