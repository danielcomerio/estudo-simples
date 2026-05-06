'use client';

/**
 * Renderer leve de markdown pra o manual. Suporta o mínimo necessário:
 * h1-h4, listas, code inline, code blocks, parágrafos, links, blockquote,
 * negrito, itálico, hr. Sem dependência externa — mantém bundle leve.
 *
 * Não suporta: tabelas, imagens, footnotes, html embarcado. O manual é
 * mantido sob nosso controle, então restrições são OK.
 */

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Slug GitHub-style: lowercase, sem acento, espaços → hífen, remove
 * pontuação. Casa com os anchors no sumário (`[texto](#slug)`).
 */
function slugify(s: string): string {
  return s
    .normalize('NFD')
    // U+0300..U+036F = Combining Diacritical Marks (acentos separados)
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

function renderInline(s: string): string {
  let out = escapeHtml(s);
  // Code inline (antes do resto pra não conflitar)
  out = out.replace(/`([^`\n]+?)`/g, '<code>$1</code>');
  // Bold
  out = out.replace(/\*\*([^*\n]+?)\*\*/g, '<strong>$1</strong>');
  // Italic (não afeta **)
  out = out.replace(/(^|[^*])\*([^*\n]+?)\*(?!\*)/g, '$1<em>$2</em>');
  // Links [texto](url)
  out = out.replace(
    /\[([^\]]+)\]\(([^)]+)\)/g,
    (_m, text, url) => `<a href="${url}">${text}</a>`
  );
  // <kbd>x</kbd> literal escapado precisa voltar
  out = out.replace(/&lt;kbd&gt;([^&]+)&lt;\/kbd&gt;/g, '<kbd>$1</kbd>');
  return out;
}

function renderMarkdown(md: string): string {
  const lines = md.split('\n');
  const out: string[] = [];
  let i = 0;
  let inUl = false;
  let inOl = false;
  let inBlockquote = false;

  const closeLists = () => {
    if (inUl) {
      out.push('</ul>');
      inUl = false;
    }
    if (inOl) {
      out.push('</ol>');
      inOl = false;
    }
  };
  const closeBlockquote = () => {
    if (inBlockquote) {
      out.push('</blockquote>');
      inBlockquote = false;
    }
  };

  while (i < lines.length) {
    const line = lines[i];

    // Code block ```
    if (line.startsWith('```')) {
      closeLists();
      closeBlockquote();
      const lang = line.slice(3).trim();
      const buf: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith('```')) {
        buf.push(lines[i]);
        i++;
      }
      i++; // pula closing ```
      out.push(
        `<pre data-lang="${escapeHtml(lang)}">${escapeHtml(buf.join('\n'))}</pre>`
      );
      continue;
    }

    // Horizontal rule
    if (/^\s*---\s*$/.test(line)) {
      closeLists();
      closeBlockquote();
      out.push('<hr>');
      i++;
      continue;
    }

    // Headings
    const h = /^(#{1,4})\s+(.*)$/.exec(line);
    if (h) {
      closeLists();
      closeBlockquote();
      const level = h[1].length;
      const rawText = h[2];
      const id = slugify(rawText);
      const text = renderInline(rawText);
      out.push(`<h${level} id="${id}">${text}</h${level}>`);
      i++;
      continue;
    }

    // Blockquote
    if (line.startsWith('> ')) {
      closeLists();
      if (!inBlockquote) {
        out.push('<blockquote>');
        inBlockquote = true;
      }
      out.push(`<p>${renderInline(line.slice(2))}</p>`);
      i++;
      continue;
    } else if (inBlockquote && line.trim() === '') {
      closeBlockquote();
      i++;
      continue;
    }

    // Unordered list
    const ul = /^[-*]\s+(.*)$/.exec(line);
    if (ul) {
      closeBlockquote();
      if (inOl) {
        out.push('</ol>');
        inOl = false;
      }
      if (!inUl) {
        out.push('<ul>');
        inUl = true;
      }
      out.push(`<li>${renderInline(ul[1])}</li>`);
      i++;
      continue;
    }

    // Ordered list
    const ol = /^\d+\.\s+(.*)$/.exec(line);
    if (ol) {
      closeBlockquote();
      if (inUl) {
        out.push('</ul>');
        inUl = false;
      }
      if (!inOl) {
        out.push('<ol>');
        inOl = true;
      }
      out.push(`<li>${renderInline(ol[1])}</li>`);
      i++;
      continue;
    }

    // Empty line
    if (line.trim() === '') {
      closeLists();
      i++;
      continue;
    }

    // Default: paragraph
    closeLists();
    out.push(`<p>${renderInline(line)}</p>`);
    i++;
  }
  closeLists();
  closeBlockquote();
  return out.join('\n');
}

export function ManualView({ markdown }: { markdown: string }) {
  const html = renderMarkdown(markdown);
  return (
    <article
      className="card manual-view"
      style={{
        maxWidth: 880,
        margin: '0 auto',
        lineHeight: 1.6,
      }}
    >
      <div dangerouslySetInnerHTML={{ __html: html }} />
    </article>
  );
}
