/**
 * Parser e renderer de Cloze (texto com lacunas reveláveis).
 *
 * Sintaxe (compatível com Anki):
 *  {{c1::texto}}              — lacuna 1, sem hint
 *  {{c1::texto::dica}}        — lacuna 1 com dica (mostrada quando escondida)
 *  {{c2::outra}}              — lacuna 2 (índices repetidos contam como uma só)
 *
 * Estado da UI:
 *  - 'hidden': todas as lacunas escondidas
 *  - 'revealed': todas reveladas
 *  (versão futura pode revelar uma a uma — por enquanto all-or-nothing)
 *
 * Helpers:
 *  - parseCloze(texto): extrai lacunas + texto base
 *  - renderClozeHTML(texto, mode): retorna HTML escapado com lacunas
 *    em <span> com classe 'cloze-hidden' ou 'cloze-revealed'.
 */

import { escapeHtml } from './utils';

export type ClozeBlank = {
  /** Índice declarado (c1, c2). Múltiplas lacunas podem ter mesmo índice. */
  idx: number;
  /** Texto correto da lacuna. */
  resposta: string;
  /** Dica opcional mostrada quando escondida. */
  dica?: string;
};

export type ParsedCloze = {
  /** Texto bruto (com marcadores ainda lá). */
  raw: string;
  /** Texto sem nenhum marcador (só as respostas). */
  fullText: string;
  /** Texto com marcadores substituídos por __ (ou dica se houver). */
  hiddenText: string;
  /** Todas as lacunas em ordem. */
  blanks: ClozeBlank[];
};

const CLOZE_RE = /\{\{c(\d+)::([^}]+?)(?:::([^}]+?))?\}\}/g;

export function parseCloze(texto: string): ParsedCloze {
  const raw = texto ?? '';
  const blanks: ClozeBlank[] = [];
  // Reseta lastIndex pra reutilizar o regex global
  CLOZE_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = CLOZE_RE.exec(raw)) !== null) {
    blanks.push({
      idx: Number(m[1]),
      resposta: m[2],
      dica: m[3],
    });
  }
  CLOZE_RE.lastIndex = 0;
  const fullText = raw.replace(CLOZE_RE, (_m, _idx, resposta) => resposta);
  CLOZE_RE.lastIndex = 0;
  const hiddenText = raw.replace(
    CLOZE_RE,
    (_m, _idx, _resposta, dica) => (dica ? `[${dica}]` : '____')
  );
  CLOZE_RE.lastIndex = 0;
  return { raw, fullText, hiddenText, blanks };
}

/**
 * Renderiza HTML com lacunas estilizadas:
 *  - mode='hidden': lacunas viram <span class="cloze-hidden">____</span>
 *    (ou a dica se houver, em formato [dica])
 *  - mode='revealed': lacunas viram <span class="cloze-revealed">resposta</span>
 *
 * Texto é HTML-escapado fora dos marcadores. Resposta também é
 * escapada (defesa contra XSS via input).
 */
export function renderClozeHTML(
  texto: string,
  mode: 'hidden' | 'revealed'
): string {
  if (!texto) return '';
  // Substitui placeholders por marcadores especiais ANTES do escape pra
  // não perder as classes ao escapar. Estratégia: parse manual.
  CLOZE_RE.lastIndex = 0;
  const out: string[] = [];
  let lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = CLOZE_RE.exec(texto)) !== null) {
    // Texto antes do marcador
    out.push(escapeHtml(texto.slice(lastIndex, m.index)).replace(/\n/g, '<br>'));
    const resposta = m[2];
    const dica = m[3];
    if (mode === 'revealed') {
      out.push(`<span class="cloze-revealed">${escapeHtml(resposta)}</span>`);
    } else {
      const inner = dica ? `[${escapeHtml(dica)}]` : '____';
      out.push(`<span class="cloze-hidden">${inner}</span>`);
    }
    lastIndex = m.index + m[0].length;
  }
  CLOZE_RE.lastIndex = 0;
  // Resto do texto
  out.push(escapeHtml(texto.slice(lastIndex)).replace(/\n/g, '<br>'));
  return out.join('');
}
