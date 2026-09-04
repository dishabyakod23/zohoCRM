import {
  ensureEmailHtmlBody,
  htmlToPlainText,
  looksLikeHtml,
  escapeHtml,
} from '../sequenceHelpers.js';

describe('sequence email HTML formatting', () => {
  it('detects HTML vs plain text', () => {
    expect(looksLikeHtml('<p>Hi</p>')).toBe(true);
    expect(looksLikeHtml('Hi\n\nThere')).toBe(false);
  });

  it('escapes HTML entities in plain text', () => {
    expect(escapeHtml('a < b & "c"')).toBe('a &lt; b &amp; &quot;c&quot;');
  });

  it('converts newlines to paragraphs and br so Outlook keeps formatting', () => {
    const input = [
      'Hi Satesh,',
      '',
      'Hope you are doing well.',
      '',
      'We work across:',
      '• Web & mobile',
      '• AI — LLMs',
      '',
      'Best,',
      'Akshay',
    ].join('\n');

    const html = ensureEmailHtmlBody(input);
    expect(html).toContain('<p style="margin:0 0 12px 0;">Hi Satesh,</p>');
    expect(html).toContain('Hope you are doing well.');
    expect(html).toContain('• Web &amp; mobile<br />• AI — LLMs');
    expect(html).toContain('Best,<br />Akshay');
    expect(looksLikeHtml(html)).toBe(true);
  });

  it('leaves existing HTML bodies unchanged', () => {
    const html = '<p>Hello <strong>world</strong></p>';
    expect(ensureEmailHtmlBody(html)).toBe(html);
  });

  it('derives plain text from HTML for the text/plain part', () => {
    expect(htmlToPlainText('<p>Hi</p><p>There<br />friend</p>')).toMatch(/Hi/);
    expect(htmlToPlainText('<p>Hi</p><p>There<br />friend</p>')).toMatch(/There/);
  });
});
