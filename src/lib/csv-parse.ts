/**
 * CSV → JSON (formato autoral do app). Mais simples pra users sem
 * skill em JSON. Parser CSV minimalista que aceita quoted fields
 * com vírgulas e quotes escapados (RFC 4180 simplificado).
 *
 * Formato esperado (header obrigatório):
 *   enunciado,alt_a,alt_b,alt_c,alt_d,alt_e,gabarito,disciplina,tema,dificuldade
 *
 * Campos opcionais: tema, dificuldade. Gabarito esperado: A/B/C/D/E
 * (case-insensitive). Linhas com qualquer dos 5 alt vazios passam
 * sem alternativa naquela letra.
 */

type CsvRow = Record<string, string>;

/**
 * Parser CSV simples: aceita quoted fields ("...") com "" pra escape
 * de aspas internas. Não suporta multiline em campos quoted (comum
 * em CSVs gerados por Excel — adicionar se demandar).
 */
function parseCsvLines(text: string): string[][] {
  const out: string[][] = [];
  // Normaliza newlines
  const src = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = src.split('\n');
  for (const line of lines) {
    if (line.trim().length === 0) continue;
    const cells: string[] = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (inQuotes) {
        if (c === '"') {
          if (line[i + 1] === '"') {
            cur += '"';
            i++;
          } else {
            inQuotes = false;
          }
        } else {
          cur += c;
        }
      } else {
        if (c === '"') {
          inQuotes = true;
        } else if (c === ',') {
          cells.push(cur);
          cur = '';
        } else {
          cur += c;
        }
      }
    }
    cells.push(cur);
    out.push(cells);
  }
  return out;
}

export function parseCsvToQuestions(text: string): {
  ok: boolean;
  questions?: unknown[];
  error?: string;
} {
  const rows = parseCsvLines(text);
  if (rows.length < 2) {
    return { ok: false, error: 'CSV vazio ou só com cabeçalho' };
  }
  const header = rows[0].map((h) => h.trim().toLowerCase());
  // Mapping de cabeçalhos esperados (aceita variações)
  const colIndex = (...names: string[]): number => {
    for (const n of names) {
      const idx = header.indexOf(n.toLowerCase());
      if (idx >= 0) return idx;
    }
    return -1;
  };
  const iEnun = colIndex('enunciado', 'pergunta', 'questao', 'questão');
  const iA = colIndex('alt_a', 'a', 'alternativa_a');
  const iB = colIndex('alt_b', 'b', 'alternativa_b');
  const iC = colIndex('alt_c', 'c', 'alternativa_c');
  const iD = colIndex('alt_d', 'd', 'alternativa_d');
  const iE = colIndex('alt_e', 'e', 'alternativa_e');
  const iGab = colIndex('gabarito', 'correta', 'resposta');
  const iDisc = colIndex('disciplina', 'disciplina_id', 'materia', 'matéria');
  const iTema = colIndex('tema', 'topico', 'tópico', 'assunto');
  const iDif = colIndex('dificuldade', 'nivel', 'nível');
  const iExpl = colIndex('explicacao', 'explicação', 'explanation');

  const requiredMissing: string[] = [];
  if (iEnun < 0) requiredMissing.push('enunciado');
  if (iA < 0) requiredMissing.push('alt_a');
  if (iB < 0) requiredMissing.push('alt_b');
  if (iGab < 0) requiredMissing.push('gabarito');
  if (iDisc < 0) requiredMissing.push('disciplina');
  if (requiredMissing.length > 0) {
    return {
      ok: false,
      error: `Cabeçalho faltando: ${requiredMissing.join(', ')}. Esperado: enunciado, alt_a, alt_b, [alt_c, alt_d, alt_e], gabarito, disciplina, [tema, dificuldade]`,
    };
  }

  const questions: unknown[] = [];
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    const get = (i: number) => (i >= 0 && i < row.length ? row[i].trim() : '');
    const enun = get(iEnun);
    if (!enun) continue; // linha vazia/comentário
    const gab = get(iGab).toUpperCase();
    if (!/^[A-E]$/.test(gab)) {
      // Pula linha com gabarito inválido
      continue;
    }
    const alts: { letra: string; texto: string; correta: boolean }[] = [];
    const addAlt = (letra: string, idx: number) => {
      const t = get(idx);
      if (!t) return;
      alts.push({ letra, texto: t, correta: letra === gab });
    };
    addAlt('A', iA);
    addAlt('B', iB);
    addAlt('C', iC);
    addAlt('D', iD);
    addAlt('E', iE);
    if (alts.length < 2) continue; // pelo menos 2 alternativas
    if (!alts.some((a) => a.correta)) continue; // gabarito não bate

    let dificuldade: number | null = null;
    if (iDif >= 0) {
      const n = parseInt(get(iDif), 10);
      if (Number.isInteger(n) && n >= 1 && n <= 5) dificuldade = n;
    }
    const disc = get(iDisc);
    const tema = iTema >= 0 ? get(iTema) || null : null;
    const explicacao = iExpl >= 0 ? get(iExpl) || null : null;

    const q: Record<string, unknown> = {
      type: 'objetiva',
      disciplina_id: disc,
      payload: {
        enunciado: enun,
        alternativas: alts,
        ...(explicacao && { explicacao_geral: explicacao }),
      },
    };
    if (tema) q.tema = tema;
    if (dificuldade !== null) q.dificuldade = dificuldade;
    questions.push(q);
  }

  if (questions.length === 0) {
    return {
      ok: false,
      error:
        'Nenhuma questão válida encontrada. Verifique enunciado, alternativas e gabarito (A-E).',
    };
  }

  return { ok: true, questions };
}

/**
 * Detecta se uma string parece ser CSV (header + linhas com vírgulas).
 * Heurística: primeira linha tem ≥ 4 vírgulas e contém "enunciado" OU
 * "questao" (case-insensitive).
 */
export function looksLikeCsv(text: string): boolean {
  const firstLine = text.trim().split('\n')[0]?.toLowerCase() ?? '';
  if (firstLine.split(',').length < 4) return false;
  return (
    firstLine.includes('enunciado') ||
    firstLine.includes('questao') ||
    firstLine.includes('questão') ||
    firstLine.includes('pergunta')
  );
}
