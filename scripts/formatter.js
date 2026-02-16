class MarkdownFormatter {
  constructor() {
    this.tokenStore = null;
  }
  escapeHtml(unsafe) {
    return unsafe
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }
  createTokenStore() {
    const store = [];
    return {
      add: (html) => {
        const idx = store.length;
        store.push(html);
        return `@@TOKEN${idx}@@`;
      },
      restore: (text) => {
        return text.replace(/@@TOKEN(\d+)@@/g, (_, n) => store[Number(n)] || "");
      }
    };
  }
  extractFencedCodeBlocks(md, t) {
    return md.replace(/```([^\n\r]*)\r?\n([\s\S]*?)\r?\n```/g, (_, lang, code) => {
      const langCls = (lang || '').trim().replace(/[^\w-]/g, '') || '';
      const escaped = this.escapeHtml(code);
      const codeHtml = `<pre class="code-block"><code class="language-${langCls}" data-lang="${this.escapeHtml(langCls)}">${escaped}</code></pre>`;
      return t.add(codeHtml);
    });
  }
  extractIndentedCodeBlocks(md, t) {
    return md.replace(/(?:\n|^)((?:(?:\t| {4}).*(?:\n|$))+)/g, (m, block) => {
      const unindented = block.replace(/^(?:\t| {4})/gm, '');
      const escaped = this.escapeHtml(unindented);
      const codeHtml = `<pre class="code-block"><code>${escaped}</code></pre>`;
      return t.add(codeHtml);
    });
  }
  processInlineFormattingWithEscape(text) {
    text = text.replace(/\*\*(.+?)\*\*/g, (match, content) => {
      return `<strong>${this.escapeHtml(content)}</strong>`;
    });
    text = text.replace(/__(.+?)__/g, (match, content) => {
      return `<strong>${this.escapeHtml(content)}</strong>`;
    });
    text = text.replace(/(^|[^\*])\*([^*\s][\s\S]*?[^*\s])\*(?!\*)/g, (m, p1, p2) => {
      return `${p1}<em>${this.escapeHtml(p2)}</em>`;
    });
    text = text.replace(/(^|[^_])_([^_\s][\s\S]*?[^_\s])_(?!_)/g, (m, p1, p2) => {
      return `${p1}<em>${this.escapeHtml(p2)}</em>`;
    });
    text = text.replace(/`([^`]+?)`/g, (m, code) => {
      return `<code>${this.escapeHtml(code)}</code>`;
    });
    const tokens = [];
    let result = text.replace(/(<[^>]+>)/g, (tag) => {
      const idx = tokens.length;
      tokens.push(tag);
      return `##TOKEN${idx}##`;
    });
    result = this.escapeHtml(result);
    result = result.replace(/##TOKEN(\d+)##/g, (_, n) => tokens[Number(n)] || "");
    return result;
  }
  extractTables(md, t) {
    const lines = md.split(/\r?\n/);
    let i = 0;
    const out = [];
    while (i < lines.length) {
      const line = lines[i];
      const next = lines[i + 1] ?? '';
      if (line.includes('|') && /^\s*\|?[:\-\s|]+\|?\s*$/.test(next)) {
        const tblLines = [line];
        i += 2;
        while (i < lines.length && lines[i].includes('|')) {
          tblLines.push(lines[i]);
          i++;
        }
        const header = tblLines[0].trim();
        const rows = tblLines.slice(1);
        const headers = header.split('|').map(h => h.trim()).filter(Boolean);
        const htmlRows = [];
        for (const r of rows) {
          const cols = r.split('|').map(c => c.trim()).filter(Boolean);
          htmlRows.push(cols);
        }
        let tableHtml = '<div class="md-table-wrap"><table class="md-table"><thead><tr>';
        for (const h of headers) {
          tableHtml += `<th>${this.processInlineFormattingWithEscape(h)}</th>`;
        }
        tableHtml += '</tr></thead>';
        if (htmlRows.length) {
          tableHtml += '<tbody>';
          for (const cols of htmlRows) {
            tableHtml += '<tr>';
            for (let ci = 0; ci < headers.length; ci++) {
              const cell = cols[ci] ?? '';
              tableHtml += `<td>${this.processInlineFormattingWithEscape(cell)}</td>`;
            }
            tableHtml += '</tr>';
          }
          tableHtml += '</tbody>';
        }
        tableHtml += '</table></div>';
        out.push(t.add(tableHtml));
      } else {
        out.push(this.escapeHtml(line));
        i++;
      }
    }
    return out.join('\n');
  }
  processInlineFormatting(text) {
    text = text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    text = text.replace(/__(.+?)__/g, '<strong>$1</strong>');
    text = text.replace(/(^|[^\*])\*([^*\s][\s\S]*?[^*\s])\*(?!\*)/g, (m, p1, p2) => `${p1}<em>${p2}</em>`);
    text = text.replace(/(^|[^_])_([^_\s][\s\S]*?[^_\s])_(?!_)/g, (m, p1, p2) => `${p1}<em>${p2}</em>`);
    text = text.replace(/`([^`]+?)`/g, (m, code) => `<code>${code}</code>`);
    text = text.replace(/^\s*>\s?(.*)$/gm, '<blockquote>$1</blockquote>');
    text = text.replace(/^\s*###\s+(.+)$/gm, '<h3>$1</h3>');
    text = text.replace(/^\s*##\s+(.+)$/gm, '<h2>$1</h2>');
    text = text.replace(/^\s*#\s+(.+)$/gm, '<h1>$1</h1>');
    return text;
  }
  processListsAndParagraphs(text) {
    const lines = text.split('\n');
    let inUl = false;
    let inOl = false;
    const out = [];
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const ulMatch = line.match(/^\s*[-*+]\s+(.+)$/);
      const olMatch = line.match(/^\s*\d+\.\s+(.+)$/);
      if (ulMatch) {
        if (!inUl) { out.push('<ul>'); inUl = true; }
        out.push(`<li>${ulMatch[1]}</li>`);
      } else if (olMatch) {
        if (!inOl) { out.push('<ol>'); inOl = true; }
        out.push(`<li>${olMatch[1]}</li>`);
      } else {
        if (inUl) { out.push('</ul>'); inUl = false; }
        if (inOl) { out.push('</ol>'); inOl = false; }
        const trimmed = line.trim();
        if (trimmed === '') {
          out.push('');
        } else {
          out.push(line);
        }
      }
    }
    if (inUl) out.push('</ul>');
    if (inOl) out.push('</ol>');
    const joined = out.join('\n');
    const paragraphs = joined.split(/\n{2,}/);
    const final = paragraphs.map(p => {
      const t = p.trim();
      if (!t) return '';
      if (/^<(h1|h2|h3|ul|ol|pre|blockquote|table|div)/.test(t)) return t;
      return `<p>${t.replace(/\n/g, '<br>')}</p>`;
    }).join('\n');
    return final;
  }
  format(markdownText = '') {
    if (!markdownText) return '';
    const t = this.createTokenStore();
    let s = this.extractFencedCodeBlocks(markdownText, t);
    s = this.extractIndentedCodeBlocks(s, t);
    s = this.extractTables(s, t);
    s = this.processInlineFormatting(s);
    s = this.processListsAndParagraphs(s);
    s = t.restore(s);
    return s;
  }
}
export { MarkdownFormatter };