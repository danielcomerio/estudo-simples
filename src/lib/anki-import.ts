/**
 * Importador de notes do Anki em formato TXT (export "Notes in Plain
 * Text"). Cada linha é uma nota: campos separados por TAB.
 *
 * Formato esperado (default Anki):
 *   <Front>\t<Back>[\t<Tags>]
 *
 * Linhas começando com `#` são comentários (Anki escreve metadata).
 *
 * Conversão pro nosso formato: cada linha vira um card type='flashcard'
 * com payload {frente, verso}. Tags do Anki vão pra `tags`.
 *
 * Não suporta .apkg (zip+sqlite) — exigiria sql.js +700KB.
 * User exporta via "Export → Cards → Notes in Plain Text" no Anki.
 */

import { canonicalizeTagList } from './tag-dictionary';
import { normalizeTagList } from './normalize';

export type AnkiTxtRow = {
  frente: string;
  verso: string;
  tags: string[];
};

export type AnkiTxtParseResult = {
  rows: AnkiTxtRow[];
  errors: string[];
  totalLines: number;
  commentLines: number;
};

export function parseAnkiTxt(text: string): AnkiTxtParseResult {
  const result: AnkiTxtParseResult = {
    rows: [],
    errors: [],
    totalLines: 0,
    commentLines: 0,
  };
  const lines = text.split(/\r?\n/);
  result.totalLines = lines.length;

  // Detecta separator do header se presente:
  //   "#separator:tab" / "#separator:comma"
  // Default tab.
  let sep = '\t';
  for (const line of lines) {
    if (line.startsWith('#separator:')) {
      const v = line.slice('#separator:'.length).trim().toLowerCase();
      if (v === 'comma' || v === ',') sep = ',';
      else if (v === 'semicolon' || v === ';') sep = ';';
      else if (v === 'pipe' || v === '|') sep = '|';
      else sep = '\t';
      break;
    }
  }

  let tagsCol = -1;

  for (const raw of lines) {
    const line = raw.replace(/﻿/g, ''); // BOM
    if (!line.trim()) continue;
    if (line.startsWith('#')) {
      result.commentLines++;
      // detect tags column index from #tags column:
      const m = line.match(/^#tags column:(\d+)/i);
      if (m) tagsCol = Math.max(0, parseInt(m[1], 10) - 1);
      continue;
    }
    // CSV simples: não suporta aspas multi-linha. Anki TXT default não usa.
    const parts = sep === ',' ? splitCsv(line) : line.split(sep);
    if (parts.length < 2) {
      result.errors.push(`Linha ignorada (sem campo verso): ${line.slice(0, 80)}`);
      continue;
    }
    const frente = stripHtml(parts[0]).trim();
    const verso = stripHtml(parts[1]).trim();
    let tags: string[] = [];
    if (tagsCol >= 0 && tagsCol < parts.length) {
      tags = canonicalizeTagList(normalizeTagList(parts[tagsCol]));
    } else if (parts.length >= 3) {
      // fallback: última coluna provavelmente é tags
      const last = parts[parts.length - 1];
      if (last && !last.includes('<')) {
        tags = canonicalizeTagList(normalizeTagList(last));
      }
    }
    if (!frente || !verso) {
      result.errors.push(`Linha ignorada (frente/verso vazios): ${line.slice(0, 80)}`);
      continue;
    }
    result.rows.push({ frente, verso, tags });
  }

  return result;
}

/**
 * Strip HTML básico (Anki exporta com <br>, <b>, etc). Decode entities
 * comuns. Mantém quebras de linha.
 */
function stripHtml(s: string): string {
  if (!s) return '';
  return s
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/?(b|i|u|em|strong|span|div|p|font)[^>]*>/gi, '')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function splitCsv(line: string): string[] {
  // CSV trivial sem aspas — apropriado pro Anki TXT
  // Anki exporta com escaping mínimo se separator não conflita.
  const parts: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"' && !inQuotes) {
      inQuotes = true;
      continue;
    }
    if (ch === '"' && inQuotes) {
      if (line[i + 1] === '"') {
        cur += '"';
        i++;
        continue;
      }
      inQuotes = false;
      continue;
    }
    if (ch === ',' && !inQuotes) {
      parts.push(cur);
      cur = '';
      continue;
    }
    cur += ch;
  }
  parts.push(cur);
  return parts;
}

/**
 * Converte rows pra estrutura compatível com parseImportBatch (formato
 * autoral do app). Cada row vira flashcard.
 */
export function ankiRowsToImport(rows: AnkiTxtRow[], disciplinaDefault?: string) {
  return rows.map((r) => ({
    type: 'flashcard' as const,
    disciplina_id: disciplinaDefault || 'sem-disciplina',
    frente: r.frente,
    verso: r.verso,
    tags: r.tags,
    origem: 'autoral' as const,
  }));
}
