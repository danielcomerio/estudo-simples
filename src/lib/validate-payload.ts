/**
 * Validação leve de payload por tipo de questão. Usado por importers
 * (real-import, anki-import, parse-pasted-text) e por parsers IA pra
 * rejeitar antes de salvar.
 *
 * Retorna { ok: true, normalized? } ou { ok: false, errors }.
 *
 * Defense-in-depth: UI (TS) → lib (validação) → DB (CHECK + RLS).
 */

import type { QuestionType } from './types';

export type ValidationResult =
  | { ok: true; warnings?: string[] }
  | { ok: false; errors: string[]; warnings?: string[] };

const MAX_ENUNCIADO = 50_000;
const MAX_ALT_TEXT = 5_000;
const MAX_FRENTE = 5_000;
const MAX_VERSO = 10_000;
const MAX_CLOZE = 20_000;

export function validatePayload(
  type: QuestionType,
  payload: unknown
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return { ok: false, errors: ['payload inválido (não é objeto)'] };
  }
  const p = payload as Record<string, unknown>;

  switch (type) {
    case 'objetiva': {
      if (typeof p.enunciado !== 'string' || p.enunciado.trim().length < 1) {
        errors.push('objetiva: enunciado obrigatório (≥5 chars)');
      } else if (p.enunciado.length > MAX_ENUNCIADO) {
        errors.push(`objetiva: enunciado > ${MAX_ENUNCIADO} chars`);
      }
      if (!Array.isArray(p.alternativas) || p.alternativas.length < 2) {
        errors.push('objetiva: alternativas mínimas: 2');
      } else if (p.alternativas.length > 6) {
        warnings.push('objetiva: >6 alternativas (não usual)');
      } else {
        const letras = new Set<string>();
        let temCorreta = false;
        for (let i = 0; i < p.alternativas.length; i++) {
          const a = p.alternativas[i] as Record<string, unknown>;
          if (typeof a?.letra !== 'string' || !/^[A-Ea-e]$/.test(a.letra)) {
            errors.push(`alternativa ${i + 1}: letra inválida (esperado A-E)`);
          } else if (letras.has(a.letra.toUpperCase())) {
            errors.push(`alternativa ${i + 1}: letra ${a.letra} duplicada`);
          } else {
            letras.add(a.letra.toUpperCase());
          }
          if (typeof a?.texto !== 'string' || !a.texto.trim()) {
            errors.push(`alternativa ${i + 1}: texto vazio`);
          } else if ((a.texto as string).length > MAX_ALT_TEXT) {
            errors.push(`alternativa ${i + 1}: texto > ${MAX_ALT_TEXT}`);
          }
          if (a.correta === true) temCorreta = true;
        }
        if (!temCorreta && typeof p.gabarito !== 'string') {
          errors.push('objetiva: nenhuma alternativa marcada correta e sem gabarito');
        }
      }
      break;
    }
    case 'discursiva': {
      const enun = p.enunciado ?? p.enunciado_completo;
      if (typeof enun !== 'string' || enun.trim().length < 1) {
        errors.push('discursiva: enunciado obrigatório');
      }
      if (
        typeof p.espelho_resposta !== 'string' ||
        p.espelho_resposta.trim().length < 1
      ) {
        warnings.push('discursiva: sem espelho — autoavaliação fica fraca');
      }
      break;
    }
    case 'cloze': {
      if (typeof p.texto !== 'string' || p.texto.trim().length < 1) {
        errors.push('cloze: texto obrigatório');
      } else if (p.texto.length > MAX_CLOZE) {
        errors.push(`cloze: texto > ${MAX_CLOZE}`);
      } else if (!/\{\{c\d+::[^}]+\}\}/.test(p.texto)) {
        errors.push('cloze: sem marcador {{c1::resposta}}');
      }
      break;
    }
    case 'flashcard': {
      if (typeof p.frente !== 'string' || p.frente.trim().length < 1) {
        errors.push('flashcard: frente obrigatória');
      } else if (p.frente.length > MAX_FRENTE) {
        errors.push(`flashcard: frente > ${MAX_FRENTE}`);
      }
      if (typeof p.verso !== 'string' || p.verso.trim().length < 1) {
        errors.push('flashcard: verso obrigatório');
      } else if (p.verso.length > MAX_VERSO) {
        errors.push(`flashcard: verso > ${MAX_VERSO}`);
      }
      break;
    }
    case 'soma': {
      if (typeof p.enunciado !== 'string' || p.enunciado.trim().length < 1) {
        errors.push('soma: enunciado obrigatório');
      }
      if (!Array.isArray(p.itens) || p.itens.length < 2) {
        errors.push('soma: itens mínimos: 2');
      } else {
        let temCorreta = false;
        for (let i = 0; i < p.itens.length; i++) {
          const it = p.itens[i] as Record<string, unknown>;
          if (typeof it?.valor !== 'number' || it.valor <= 0) {
            errors.push(`item ${i + 1}: valor numérico positivo obrigatório`);
          }
          if (typeof it?.texto !== 'string' || !it.texto.trim()) {
            errors.push(`item ${i + 1}: texto vazio`);
          }
          if (it.correta === true) temCorreta = true;
        }
        if (!temCorreta) {
          warnings.push('soma: nenhum item marcado correto (gabarito = 0)');
        }
      }
      break;
    }
  }

  if (errors.length > 0) return { ok: false, errors, warnings };
  return { ok: true, warnings: warnings.length > 0 ? warnings : undefined };
}
