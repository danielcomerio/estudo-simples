'use client';

/**
 * Highlights persistidos por questão. Armazena offsets {start, end}
 * relativos ao texto plain do enunciado (sem HTML). Aplica via
 * post-process no DOM após render.
 *
 * Per-device (localStorage) — sem migration.
 *
 * Storage: 'estudo-simples:highlights:v1' = {
 *   [questionId]: Array<{ start: number, end: number, color?: string }>
 * }
 */

const KEY = 'estudo-simples:highlights:v1';

export type Highlight = {
  start: number;
  end: number;
  color?: string;
};

type Store = Record<string, Highlight[]>;

function readStore(): Store {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return {};
    return parsed;
  } catch {
    return {};
  }
}

function writeStore(s: Store): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* ignore */
  }
}

export function getHighlights(questionId: string): Highlight[] {
  return readStore()[questionId] ?? [];
}

export function addHighlight(questionId: string, h: Highlight): void {
  const s = readStore();
  const list = s[questionId] ?? [];
  // Evita duplicatas exatas
  if (list.some((x) => x.start === h.start && x.end === h.end)) return;
  list.push(h);
  list.sort((a, b) => a.start - b.start);
  s[questionId] = list;
  writeStore(s);
}

export function removeHighlight(questionId: string, start: number, end: number): void {
  const s = readStore();
  const list = s[questionId] ?? [];
  s[questionId] = list.filter((h) => !(h.start === start && h.end === end));
  if (s[questionId].length === 0) delete s[questionId];
  writeStore(s);
}

export function clearHighlights(questionId: string): void {
  const s = readStore();
  delete s[questionId];
  writeStore(s);
}

/**
 * Captura a seleção atual em um elemento e converte pra offset
 * {start, end} relativo ao textContent. Retorna null se sem seleção
 * ou se cross-element.
 */
export function captureSelection(container: HTMLElement): Highlight | null {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0 || sel.toString().length === 0) return null;
  const range = sel.getRangeAt(0);
  if (!container.contains(range.commonAncestorContainer)) return null;

  // Calcula offset start: percorre node tree do container até o startContainer
  const preRange = range.cloneRange();
  preRange.selectNodeContents(container);
  preRange.setEnd(range.startContainer, range.startOffset);
  const start = preRange.toString().length;
  const end = start + range.toString().length;
  if (end <= start) return null;
  return { start, end };
}

/**
 * Aplica highlights ao texto plain. Retorna HTML escapado com
 * <mark> nas posições. Útil pra render.
 */
export function applyHighlightsToText(text: string, highlights: Highlight[]): string {
  if (!text) return '';
  if (highlights.length === 0) return escapeHTML(text);
  // Ordena + funde overlaps
  const sorted = [...highlights].sort((a, b) => a.start - b.start);
  const merged: Highlight[] = [];
  for (const h of sorted) {
    const last = merged[merged.length - 1];
    if (last && h.start <= last.end) {
      last.end = Math.max(last.end, h.end);
    } else {
      merged.push({ ...h });
    }
  }
  let out = '';
  let cursor = 0;
  for (const h of merged) {
    if (h.start > cursor) out += escapeHTML(text.slice(cursor, h.start));
    out += `<mark style="background:${h.color ?? 'rgba(255,235,59,0.5)'};padding:0 2px;border-radius:2px">${escapeHTML(text.slice(h.start, h.end))}</mark>`;
    cursor = h.end;
  }
  if (cursor < text.length) out += escapeHTML(text.slice(cursor));
  return out;
}

function escapeHTML(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
