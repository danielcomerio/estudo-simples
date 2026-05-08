/**
 * Heurística client-side pra extrair questão objetiva de texto bruto
 * (PDF colado, Word, página HTML). SEM IA — parser linha-a-linha.
 *
 * Padrões cobertos:
 *  - Enunciado: tudo antes da primeira alternativa
 *  - Alternativas: linha começando com "A)", "a)", "(A)", "A.", "A -", etc
 *  - Gabarito: "Gabarito: B", "Resposta: B", "GABARITO B"
 *  - Comentário/explicação: linha "Comentário: ..."
 *
 * Output: estrutura compatível com import autoral. null se não detectou.
 */

import { canonicalizeTagList } from './tag-dictionary';
import { normalizeTagList } from './normalize';

export type ParsedPastedQuestion = {
  enunciado: string;
  alternativas: Array<{ letra: string; texto: string; correta?: boolean }>;
  gabarito?: string;
  explicacao_geral?: string;
  raw: string;
};

// Linha começando com (A) | A) | A. | A - | A:
const ALT_LINE_RE = /^\s*(?:\(([A-Ea-e])\)|([A-Ea-e])\s*[)\.\-—:])\s+(.+)$/;

// Linhas de "metadados" finais que param o parser de alternativas
const META_LINE_RE =
  /^\s*(gabarito|resposta|gab|alternativa\s+correta|correct[oa]|coment[áa]rio|explica|fonte|justificativa|resolu[çc][ãa]o)\b/i;

const GABARITO_RE =
  /(?:^|\n)\s*(?:gabarito|resposta|gab|alternativa\s+correta|correct[oa])\s*[:\-]?\s*\(?([A-Ea-e])\)?/i;

const COMENT_RE =
  /(?:^|\n)\s*(?:coment[áa]rio|explica[çc][ãa]o|fonte|justificativa|resolu[çc][ãa]o)\s*[:\-]?\s*([\s\S]+?)$/im;

export function parsePastedText(raw: string): ParsedPastedQuestion | null {
  if (!raw || typeof raw !== 'string') return null;
  const text = raw.replace(/\r\n/g, '\n').trim();
  if (text.length < 20) return null;

  const lines = text.split('\n');
  const alts: Array<{ letra: string; texto: string }> = [];
  let firstAltLine = -1;
  let curBuffer: string[] = [];
  let curLetra: string | null = null;

  const flush = () => {
    if (curLetra && curBuffer.length > 0) {
      const txt = curBuffer.join(' ').trim();
      if (txt && !alts.find((a) => a.letra === curLetra)) {
        alts.push({ letra: curLetra, texto: txt });
      }
    }
    curLetra = null;
    curBuffer = [];
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const m = ALT_LINE_RE.exec(line);
    if (m) {
      flush();
      if (firstAltLine < 0) firstAltLine = i;
      curLetra = ((m[1] ?? m[2]) || '').toUpperCase();
      curBuffer = [m[3].trim()];
      continue;
    }
    if (META_LINE_RE.test(line)) {
      flush();
      curLetra = null;
      break;
    }
    if (curLetra && line.trim().length === 0) continue;
    if (curLetra) curBuffer.push(line.trim());
  }
  flush();

  if (alts.length < 2) return null;

  const enunciado =
    firstAltLine > 0
      ? lines.slice(0, firstAltLine).join('\n').trim()
      : lines.slice(0, 3).join(' ').trim();

  if (enunciado.length < 5) return null;

  const gabMatch = text.match(GABARITO_RE);
  const gabarito = gabMatch?.[1]?.toUpperCase();

  const comentMatch = text.match(COMENT_RE);
  const explicacao_geral = comentMatch?.[1]?.trim().slice(0, 2000);

  const altsComCorreta = alts.map((a) => ({
    ...a,
    correta: gabarito ? a.letra === gabarito : undefined,
  }));

  return {
    enunciado,
    alternativas: altsComCorreta,
    gabarito,
    explicacao_geral,
    raw: text,
  };
}

/**
 * Converte ParsedPastedQuestion pra formato autoral importável.
 * Adiciona tags 'parsed-pasted' pra rastrear origem.
 */
export function pastedToImportItem(
  parsed: ParsedPastedQuestion,
  disciplinaDefault?: string
) {
  return {
    type: 'objetiva' as const,
    disciplina_id: disciplinaDefault || 'sem-disciplina',
    enunciado: parsed.enunciado,
    alternativas: parsed.alternativas,
    gabarito: parsed.gabarito,
    explicacao_geral: parsed.explicacao_geral,
    origem: 'autoral' as const,
    tags: canonicalizeTagList(normalizeTagList(['parsed-pasted'])),
  };
}
