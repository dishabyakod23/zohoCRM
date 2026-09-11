import {
  isNoteBodyEmpty,
  markdownToHtml,
  noteBodyToHtml,
  sanitizeNoteHtml,
} from '../noteRichText.js';

describe('noteRichText', () => {
  it('renders markdown bold without showing asterisks', () => {
    const html = markdownToHtml('**Meeting:** Transmed');
    expect(html).toContain('<strong>Meeting:</strong>');
    expect(html).not.toContain('**');
  });

  it('renders headings and lists', () => {
    const html = markdownToHtml('# Title\n\n## Section\n\n- One\n- Two\n\n1. First\n2. Second');
    expect(html).toContain('<h1>Title</h1>');
    expect(html).toContain('<h2>Section</h2>');
    expect(html).toContain('<ul>');
    expect(html).toContain('<ol>');
    expect(html).toContain('<li>One</li>');
  });

  it('treats existing HTML notes as HTML', () => {
    const html = noteBodyToHtml('<p><strong>Bold</strong> text</p>');
    expect(html).toContain('<strong>Bold</strong>');
  });

  it('detects empty rich-text bodies', () => {
    expect(isNoteBodyEmpty('')).toBe(true);
    expect(isNoteBodyEmpty('<p><br></p>')).toBe(true);
    expect(isNoteBodyEmpty('<p>Hello</p>')).toBe(false);
  });

  it('strips script tags when sanitizing', () => {
    expect(sanitizeNoteHtml('<p>Hi</p><script>alert(1)</script>')).toBe('<p>Hi</p>');
  });
});
