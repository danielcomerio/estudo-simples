import type { Question } from './types';

/**
 * Export Anki CSV. Formato Anki "Basic" aceita CSV com:
 *   - Coluna 1: Front (frente do card)
 *   - Coluna 2: Back (verso)
 *   - Coluna 3 (opcional): Tags (separadas por espaço)
 *
 * Mapeia tipos do app:
 *   - Objetiva: front=enunciado, back=alternativas + gabarito + explicação
 *   - Discursiva: front=enunciado, back=espelho_resposta
 *   - Cloze: front=texto com lacunas, back=texto completo
 *   - Flashcard: front=frente, back=verso
 *
 * Útil pra users que usam Anki em paralelo ou querem migrar.
 */

function csvEscape(s: string): string {
  // Anki aceita CSV com quoted fields. Aspas duplas dentro escapadas com "".
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

function objetivaToFrontBack(q: Question): { front: string; back: string } {
  const p = q.payload as Record<string, unknown>;
  const enun = (p.enunciado as string) ?? '';
  const alts = Array.isArray(p.alternativas)
    ? (p.alternativas as Array<{ letra: string; texto: string; correta?: boolean; explicacao?: string }>)
    : [];
  const front =
    enun +
    '\n\n' +
    alts.map((a) => `${a.letra}) ${a.texto}`).join('\n');
  const correct = alts.find((a) => a.correta);
  const explicacaoGeral = (p.explicacao_geral as string) ?? '';
  const back =
    `Gabarito: ${correct?.letra ?? '?'}` +
    (correct?.texto ? `\n${correct.texto}` : '') +
    (correct?.explicacao ? `\n\nPor que está certa: ${correct.explicacao}` : '') +
    (explicacaoGeral ? `\n\nContexto: ${explicacaoGeral}` : '');
  return { front, back };
}

function discursivaToFrontBack(q: Question): { front: string; back: string } {
  const p = q.payload as Record<string, unknown>;
  const enun =
    (p.enunciado as string) ??
    (p.enunciado_completo as string) ??
    [(p.texto_base as string) ?? '', (p.comando as string) ?? '']
      .filter(Boolean)
      .join('\n\n');
  const espelho =
    (p.espelho_resposta as string) ?? (p.espelho as string) ?? '(sem espelho)';
  return { front: enun, back: espelho };
}

function clozeToFrontBack(q: Question): { front: string; back: string } {
  const p = q.payload as Record<string, unknown>;
  const texto = (p.texto as string) ?? '';
  // Front: substitui {{c1::resposta}} por [...]
  const front = texto.replace(/\{\{c\d+::([^}]+)\}\}/g, '[___]');
  // Back: mostra resposta completa
  const back = texto.replace(/\{\{c\d+::([^}]+)\}\}/g, '$1');
  return { front, back };
}

function flashcardToFrontBack(q: Question): { front: string; back: string } {
  const p = q.payload as Record<string, unknown>;
  return {
    front: (p.frente as string) ?? '',
    back: (p.verso as string) ?? '',
  };
}

export function questionsToAnkiCsv(questions: Question[]): string {
  // Header opcional pro Anki — comentários começam com #
  const lines = ['#separator:Comma', '#html:false'];
  for (const q of questions) {
    let pair: { front: string; back: string };
    switch (q.type) {
      case 'objetiva':
        pair = objetivaToFrontBack(q);
        break;
      case 'discursiva':
        pair = discursivaToFrontBack(q);
        break;
      case 'cloze':
        pair = clozeToFrontBack(q);
        break;
      case 'flashcard':
        pair = flashcardToFrontBack(q);
        break;
      default:
        continue;
    }
    if (!pair.front.trim() || !pair.back.trim()) continue;
    const tags = [
      q.disciplina_id ?? '',
      ...(q.tags ?? []),
    ]
      .filter(Boolean)
      .map((t) => t.replace(/\s+/g, '_')) // Anki tags não permitem espaço
      .join(' ');
    lines.push(
      [csvEscape(pair.front), csvEscape(pair.back), csvEscape(tags)].join(',')
    );
  }
  return lines.join('\n');
}

export function downloadAnkiCsv(content: string, filename = 'estudo-simples-anki.csv'): void {
  if (typeof window === 'undefined') return;
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
