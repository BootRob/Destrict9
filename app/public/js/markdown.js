// Minimal Markdown to DOM renderer for onboarding guides.
// Builds DOM nodes with textContent only (never innerHTML), so guide text can't inject markup.
// Supports: # headings, paragraphs, - / * / 1. lists, > quotes, | tables |, **bold**, *italic*, `code`.

function inline(text) {
  const frag = document.createDocumentFragment();
  const re = /\*\*(.+?)\*\*|\*(.+?)\*|`(.+?)`/g;
  let last = 0;
  for (const m of text.matchAll(re)) {
    if (m.index > last) frag.append(text.slice(last, m.index));
    const tag = m[1] != null ? 'strong' : m[2] != null ? 'em' : 'code';
    const node = document.createElement(tag);
    node.textContent = m[1] ?? m[2] ?? m[3];
    frag.append(node);
    last = m.index + m[0].length;
  }
  if (last < text.length) frag.append(text.slice(last));
  return frag;
}

const el = (tag, text) => {
  const node = document.createElement(tag);
  if (text != null) node.append(inline(text));
  return node;
};
const cells = (line) => line.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim());

/** Renders Markdown into a DocumentFragment. Pass { skipTitle: true } to leave out the first "# " heading. */
export function renderMarkdown(markdown, { skipTitle = false } = {}) {
  const out = document.createDocumentFragment();
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  let i = 0;
  let titleSkipped = !skipTitle;

  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) { i++; continue; }

    const heading = line.match(/^(#{1,4})\s+(.*)$/);
    if (heading) {
      if (!titleSkipped && heading[1].length === 1) { titleSkipped = true; i++; continue; }
      out.append(el(`h${Math.min(heading[1].length + 1, 5)}`, heading[2]));
      i++;
      continue;
    }

    if (/^>\s?/.test(line)) {
      const quote = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) quote.push(lines[i++].replace(/^>\s?/, ''));
      out.append(el('blockquote', quote.join(' ')));
      continue;
    }

    if (/^\s*([-*]|\d+\.)\s+/.test(line)) {
      const ordered = /^\s*\d+\./.test(line);
      const list = document.createElement(ordered ? 'ol' : 'ul');
      while (i < lines.length && /^\s*([-*]|\d+\.)\s+/.test(lines[i])) {
        list.append(el('li', lines[i++].replace(/^\s*([-*]|\d+\.)\s+/, '')));
      }
      out.append(list);
      continue;
    }

    if (/^\s*\|/.test(line)) {
      const rows = [];
      while (i < lines.length && /^\s*\|/.test(lines[i])) rows.push(lines[i++]);
      const table = document.createElement('table');
      const body = rows.filter((r) => !/^\s*\|?[\s:|-]+\|?\s*$/.test(r)).map(cells);
      body.forEach((row, n) => {
        const tr = document.createElement('tr');
        for (const c of row) tr.append(el(n === 0 ? 'th' : 'td', c));
        table.append(tr);
      });
      out.append(table);
      continue;
    }

    const para = [];
    while (i < lines.length && lines[i].trim() && !/^(#{1,4}\s|>|\s*([-*]|\d+\.)\s|\s*\|)/.test(lines[i])) para.push(lines[i++].trim());
    out.append(el('p', para.join(' ')));
  }
  return out;
}
