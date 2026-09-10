import { parseCsvText, splitCsvRecords } from '../csvHelpers.js';

describe('csvHelpers', () => {
  it('parses simple CSV rows', () => {
    const { headers, rows } = parseCsvText('email,first_name\na@b.com,Ada\nc@d.com,Grace\n');
    expect(headers).toEqual(['email', 'first_name']);
    expect(rows).toHaveLength(2);
    expect(rows[0].email).toBe('a@b.com');
    expect(rows[1].first_name).toBe('Grace');
  });

  it('keeps newlines inside quoted fields as one row', () => {
    const csv = [
      'email,description',
      '"a@b.com","line1',
      'line2"',
      'c@d.com,ok',
    ].join('\n');
    const { rows } = parseCsvText(csv);
    expect(splitCsvRecords(csv)).toHaveLength(3);
    expect(rows).toHaveLength(2);
    expect(rows[0].email).toBe('a@b.com');
    expect(rows[0].description).toContain('line1');
    expect(rows[0].description).toContain('line2');
    expect(rows[1].email).toBe('c@d.com');
  });
});
