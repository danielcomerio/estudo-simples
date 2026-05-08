/**
 * Exporta questões em formato Markdown compatível com Notion/Obsidian.
 *
 * Cada questão vira um bloco H2 com metadados (disciplina, banca,
 * tipo, dificuldade, tags como #tags).
 *
 * Tipos cobertos:
 *  - objetiva: enunciado + alternativas, gabarito em destaque
 *  - discursiva: enunciado + espelho expandível
 *  - cloze: texto com lacunas marcadas
 *  - flashcard: frente / verso
 */

import type { Question } from './types';

export function questionsToMarkdown(questions: Question[]): string {
  const lines: string[] = [
    `# Banco exportado — Estudo Simples`,
    ``,
    `Total: ${questions.length} questões. Exportado em ${new Date().toISOString()}`,
    ``,
    `---`,
    ``,
  ];

  for (const q of questions) {
    const p = q.payload as {
      enunciado?: string;
      espelho_resposta?: string;
      explicacao_geral?: string;
      texto?: string;
      explicacao?: string;
      frente?: string;
      verso?: string;
      gabarito?: string;
      alternativas?: Array<{ letra: string; texto: string; correta?: boolean }>;
    };

    const title =
      (p.enunciado ?? p.frente ?? p.texto ?? '(sem enunciado)').slice(0, 80) +
      ((p.enunciado ?? p.frente ?? p.texto ?? '').length > 80 ? '…' : '');

    lines.push(`## ${title}`);
    lines.push('');

    // Metadata block
    const meta: string[] = [];
    if (q.disciplina_id) meta.push(`**Disciplina**: ${q.disciplina_id}`);
    if (q.banca_estilo) meta.push(`**Banca**: ${q.banca_estilo}`);
    if (q.dificuldade != null) meta.push(`**Dificuldade**: ${q.dificuldade}/5`);
    meta.push(`**Tipo**: ${q.type}`);
    if (q.origem) meta.push(`**Origem**: ${q.origem}`);
    if (Array.isArray(q.tags) && q.tags.length > 0) {
      meta.push(`**Tags**: ${q.tags.map((t) => '#' + t).join(' ')}`);
    }
    if (meta.length > 0) {
      lines.push(meta.join('  \n'));
      lines.push('');
    }

    // Body por tipo
    if (q.type === 'objetiva') {
      if (p.enunciado) {
        lines.push(p.enunciado);
        lines.push('');
      }
      if (Array.isArray(p.alternativas)) {
        for (const a of p.alternativas) {
          const mark = a.correta ? ' **✓**' : '';
          lines.push(`- **${a.letra})** ${a.texto}${mark}`);
        }
        lines.push('');
      }
      if (p.gabarito) {
        lines.push(`> Gabarito: **${p.gabarito}**`);
        lines.push('');
      }
      if (p.explicacao_geral) {
        lines.push(`### Explicação`);
        lines.push(p.explicacao_geral);
        lines.push('');
      }
    } else if (q.type === 'discursiva') {
      if (p.enunciado) {
        lines.push(p.enunciado);
        lines.push('');
      }
      if (p.espelho_resposta) {
        lines.push(`### Espelho`);
        lines.push(p.espelho_resposta);
        lines.push('');
      }
    } else if (q.type === 'cloze') {
      if (p.texto) {
        lines.push(p.texto);
        lines.push('');
      }
      if (p.explicacao) {
        lines.push(`### Explicação`);
        lines.push(p.explicacao);
        lines.push('');
      }
    } else if (q.type === 'flashcard') {
      if (p.frente) {
        lines.push(`**F:** ${p.frente}`);
        lines.push('');
      }
      if (p.verso) {
        lines.push(`**V:** ${p.verso}`);
        lines.push('');
      }
    }

    lines.push('---');
    lines.push('');
  }

  return lines.join('\n');
}

export function downloadMarkdown(content: string, filename = 'banco.md'): void {
  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function copyMarkdown(content: string): Promise<boolean> {
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      await navigator.clipboard.writeText(content);
      return true;
    }
  } catch {
    /* ignore */
  }
  return false;
}
