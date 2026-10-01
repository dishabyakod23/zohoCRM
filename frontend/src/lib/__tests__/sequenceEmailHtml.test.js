import {
  ensureEmailHtmlBody,
  htmlToPlainText,
  looksLikeHtml,
  escapeHtml,
  inlineEmailListStyles,
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

  it('inlines list styles so email clients match the preview', () => {
    const html = ensureEmailHtmlBody('<p>We do:</p><ul><li>Web</li><li>AI</li></ul><ol><li>One</li></ol>');
    expect(html).toContain('<ul style="margin:0 0 12px 0;padding-left:24px;list-style-type:disc;">');
    expect(html).toContain('<ol style="margin:0 0 12px 0;padding-left:24px;list-style-type:decimal;">');
    expect(html).toContain('<li style="margin:0 0 4px 0;">Web</li>');
    expect(html).toContain('<p>We do:</p>');
  });

  it('keeps existing list styles and is idempotent', () => {
    const styled = '<ul style="list-style:none"><li class="x">A</li></ul>';
    const once = inlineEmailListStyles(styled);
    expect(once).toContain('<ul style="list-style:none">');
    expect(once).toContain('<li class="x" style="margin:0 0 4px 0;">A</li>');
    expect(inlineEmailListStyles(once)).toBe(once);
  });

  it('turns list items into bullet lines in plain text', () => {
    const text = htmlToPlainText('<p>We do:</p><ul><li>Web</li><li>AI</li></ul><p>Thanks</p>');
    expect(text).toContain('• Web');
    expect(text).toContain('• AI');
    expect(text).toContain('Thanks');
  });

  it('derives plain text from HTML for the text/plain part', () => {
    expect(htmlToPlainText('<p>Hi</p><p>There<br />friend</p>')).toMatch(/Hi/);
    expect(htmlToPlainText('<p>Hi</p><p>There<br />friend</p>')).toMatch(/There/);
  });
});
