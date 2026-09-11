/**
 * Note body helpers: store/display rich HTML; convert legacy plain/markdown safely.
 */

export function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function isLikelyHtml(body) {
  return /<\/?(?:p|div|br|strong|b|em|i|u|ul|ol|li|h[1-6]|table|tr|td|th|span|a)\b/i.test(String(body || ''));
}

/** True when the note has no visible text (ignores empty tags / &nbsp;). */
export function isNoteBodyEmpty(body) {
  const raw = String(body || '');
  if (!raw.trim()) return true;
  const text = raw
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<\/(p|div|li|h[1-6])>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return !text;
}

/** Strip dangerous tags/attrs; keep simple formatting for notes. */
export function sanitizeNoteHtml(html) {
  let out = String(html || '');
  out = out.replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '');
  out = out.replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, '');
  out = out.replace(/<\/?(?:iframe|object|embed|form|input|button|textarea|link|meta)\b[^>]*>/gi, '');
  out = out.replace(/\son\w+\s*=\s*(['"]).*?\1/gi, '');
  out = out.replace(/\son\w+\s*=\s*[^\s>]+/gi, '');
  out = out.replace(/\shref\s*=\s*(['"])\s*javascript:[^'"]*\1/gi, ' href="#"');
  return out;
}

function formatInlineMarkdown(text) {
  let s = escapeHtml(text);
  // Bold **text** or __text__
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/__([^_]+)__/g, '<strong>$1</strong>');
  // Italic *text* (avoid list markers already handled at line level)
  s = s.replace(/(^|[\s(])\*([^*\n]+)\*(?=[\s).,!?:;]|$)/g, '$1<em>$2</em>');
  return s;
}

/**
 * Convert plain text / light Markdown (headings, bold, lists, simple tables) to HTML.
 */
export function markdownToHtml(markdown) {
  const src = String(markdown || '').replace(/\r\n/g, '\n').trim();
  if (!src) return '';

  const lines = src.split('\n');
  const blocks = [];
  let i = 0;

  const flushParagraph = (buf) => {
    const text = buf.join(' ').trim();
    if (!text) return;
    blocks.push(`<p>${formatInlineMarkdown(text)}</p>`);
  };

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) {
      i += 1;
      continue;
    }

    // Headings
    const heading = trimmed.match(/^(#{1,6})\s+(.+)$/);
    if (heading) {
      const level = Math.min(heading[1].length, 4);
      blocks.push(`<h${level}>${formatInlineMarkdown(heading[2])}</h${level}>`);
      i += 1;
      continue;
    }

    // Simple markdown table
    if (trimmed.includes('|') && lines[i + 1] && /^\s*\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)+\|?\s*$/.test(lines[i + 1])) {
      const rows = [];
      while (i < lines.length && lines[i].trim().includes('|')) {
        const row = lines[i].trim();
        if (/^\s*\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)+\|?\s*$/.test(row)) {
          i += 1;
          continue;
        }
        const cells = row.replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim());
        rows.push(cells);
        i += 1;
      }
      if (rows.length) {
        const [header, ...body] = rows;
        const thead = `<tr>${header.map((c) => `<th>${formatInlineMarkdown(c)}</th>`).join('')}</tr>`;
        const tbody = body.map((r) => `<tr>${r.map((c) => `<td>${formatInlineMarkdown(c)}</td>`).join('')}</tr>`).join('');
        blocks.push(`<table><thead>${thead}</thead><tbody>${tbody}</tbody></table>`);
      }
      continue;
    }

    // Unordered list
    if (/^[-*•]\s+/.test(trimmed)) {
      const items = [];
      while (i < lines.length && /^[-*•]\s+/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^[-*•]\s+/, ''));
        i += 1;
      }
      blocks.push(`<ul>${items.map((item) => `<li>${formatInlineMarkdown(item)}</li>`).join('')}</ul>`);
      continue;
    }

    // Ordered list
    if (/^\d+[.)]\s+/.test(trimmed)) {
      const items = [];
      while (i < lines.length && /^\d+[.)]\s+/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^\d+[.)]\s+/, ''));
        i += 1;
      }
      blocks.push(`<ol>${items.map((item) => `<li>${formatInlineMarkdown(item)}</li>`).join('')}</ol>`);
      continue;
    }

    // Paragraph: gather consecutive non-empty, non-special lines
    const buf = [];
    while (i < lines.length) {
      const t = lines[i].trim();
      if (!t) break;
      if (/^(#{1,6})\s+/.test(t)) break;
      if (/^[-*•]\s+/.test(t)) break;
      if (/^\d+[.)]\s+/.test(t)) break;
      if (t.includes('|') && lines[i + 1] && /^\s*\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)+\|?\s*$/.test(lines[i + 1])) break;
      buf.push(t);
      i += 1;
    }
    flushParagraph(buf);
  }

  return blocks.join('');
}

export function looksLikeMarkdown(text) {
  const s = String(text || '');
  return /(^|\n)\s{0,3}#{1,6}\s|\*\*[^*]+\*\*|__[^_]+__|(^|\n)\s*[-*•]\s|(^|\n)\s*\d+[.)]\s/m.test(s);
}

/** HTML for display / editor load (legacy plain+markdown → HTML). */
export function noteBodyToHtml(body) {
  const raw = String(body || '');
  if (!raw.trim()) return '';
  if (isLikelyHtml(raw)) return sanitizeNoteHtml(raw);
  return sanitizeNoteHtml(markdownToHtml(raw));
}
