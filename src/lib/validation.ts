import type {
  Question,
  QuestionType,
  ObjetivaPayload,
  DiscursivaPayload,
} from './types';
import { newSRS, newStats } from './srs';

type AnyRecord = Record<string, unknown>;

export type ValidationResult =
  | { ok: true; type: QuestionType }
  | { ok: false; errors: string[]; type?: QuestionType };

export function detectType(obj: unknown): QuestionType | null {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return null;
  const o = obj as AnyRecord;
  if (
    o.tipo === 'discursiva' ||
    typeof o.tipo_discursiva === 'string' ||
    typeof o.espelho_resposta === 'string'
  ) {
    return 'discursiva';
  }
  if (Array.isArray(o.alternativas)) return 'objetiva';
  if (o.tipo === 'objetiva') return 'objetiva';
  return null;
}

export function validateQuestion(raw: unknown): ValidationResult {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ok: false, errors: ['Item não é um objeto JSON.'] };
  }
  const o = raw as AnyRecord;
  const type = detectType(o);
  if (!type) {
    return {
      ok: false,
      errors: [
        'Não foi possível identificar o tipo (faltam "alternativas" ou marcadores de discursiva).',
      ],
    };
  }
  const errors: string[] = [];
  if (typeof o.disciplina_id !== 'string' || !o.disciplina_id) {
    errors.push('Campo "disciplina_id" ausente ou inválido.');
  }

  if (type === 'objetiva') {
    if (typeof o.enunciado !== 'string' || !o.enunciado) {
      errors.push('Campo "enunciado" ausente.');
    }
    if (!Array.isArray(o.alternativas) || o.alternativas.length < 2) {
      errors.push('Campo "alternativas" deve ser um array com 2+ itens.');
    } else {
      const hasCorrect = o.alternativas.some(
        (a) => a && typeof a === 'object' && (a as AnyRecord).correta === true
      );
      const hasGabarito = typeof o.gabarito === 'string' && o.gabarito.length > 0;
      if (!hasCorrect && !hasGabarito) {
        errors.push(
          'Nenhuma alternativa marcada como "correta: true" e sem campo "gabarito".'
        );
      }
      o.alternativas.forEach((a, i) => {
        if (!a || typeof a !== 'object') {
          errors.push(`Alternativa ${i} não é objeto.`);
          return;
        }
        const alt = a as AnyRecord;
        if (typeof alt.letra !== 'string' || !alt.letra) {
          errors.push(`Alternativa ${i} sem "letra".`);
        }
        if (typeof alt.texto !== 'string') {
          errors.push(`Alternativa ${i} sem "texto".`);
        }
      });
    }
  } else {
    const hasEnun =
      (typeof o.enunciado_completo === 'string' && o.enunciado_completo) ||
      (typeof o.enunciado === 'string' && o.enunciado) ||
      (typeof o.comando === 'string' && o.comando);
    if (!hasEnun) {
      errors.push(
        'Discursiva sem "enunciado_completo", "enunciado" ou "comando".'
      );
    }
    if (
      typeof o.espelho_resposta !== 'string' &&
      !Array.isArray(o.rubrica) &&
      !Array.isArray(o.quesitos)
    ) {
      errors.push(
        'Discursiva sem "espelho_resposta", "rubrica" nem "quesitos" — ao menos um é necessário.'
      );
    }
  }

  return errors.length === 0 ? { ok: true, type } : { ok: false, errors, type };
}

/**
 * Recebe o JSON cru, retorna uma `Question` pronta para ser inserida no
 * estado local (sem id ainda — quem chama atribui via uuid). user_id é
 * preenchido por quem chamar.
 */
export function normalizeQuestion(
  raw: AnyRecord,
  type: QuestionType
): Omit<Question, 'id' | 'user_id' | 'created_at' | 'updated_at'> & {
  payload: ObjetivaPayload | DiscursivaPayload;
} {
  const {
    disciplina_id,
    tema,
    banca_estilo,
    dificuldade,
    type: _type,
    tipo: _tipo,
    srs: _srs,
    stats: _stats,
    id: _id,
    user_id: _user_id,
    created_at: _created_at,
    updated_at: _updated_at,
    deleted_at: _deleted_at,
    // Campos da hierarquia (migration 0002): ignoramos no import. UI da
    // etapa 0.4 será responsável por round-trip. Sem isso, eles cairiam
    // no `payload` via ...rest, criando duplicação confusa.
    topico_id: _topico_id,
    concurso_id: _concurso_id,
    tags: _tags,
    // Campos da migration 0003: idem — o normalizer de questões reais
    // (normalizeRealQuestion) seta esses campos explicitamente. Strip
    // aqui evita lixo cair no payload via spread.
    origem: _origem,
    fonte: _fonte,
    verificacao: _verificacao,
    ...rest
  } = raw;

  // payload contém o conteúdo "puro" (enunciado, alternativas, espelho, etc.)
  const payload = rest as ObjetivaPayload | DiscursivaPayload;

  // Garante consistência objetiva: se faltar gabarito mas houver `correta`, deduz; e vice-versa.
  if (type === 'objetiva') {
    const p = payload as ObjetivaPayload;
    if (Array.isArray(p.alternativas)) {
      if (!p.gabarito) {
        const c = p.alternativas.find((a) => a.correta === true);
        if (c) p.gabarito = c.letra;
      } else {
        p.alternativas.forEach((a) => {
          if (a && a.letra === p.gabarito) a.correta = true;
        });
      }
    }
  }

  const dif =
    typeof dificuldade === 'number'
      ? Math.max(1, Math.min(5, Math.round(dificuldade)))
      : null;

  return {
    type,
    disciplina_id: typeof disciplina_id === 'string' ? disciplina_id : null,
    tema: typeof tema === 'string' ? tema : null,
    banca_estilo: typeof banca_estilo === 'string' ? banca_estilo : null,
    dificuldade: dif,
    payload,
    srs: newSRS(),
    stats: newStats(),
    deleted_at: null,
  };
}

export function extractItems(parsed: unknown): unknown[] {
  if (Array.isArray(parsed)) return parsed;
  if (parsed && typeof parsed === 'object') {
    const o = parsed as AnyRecord;
    if (Array.isArray(o.questions)) return o.questions;
    if (Array.isArray(o.items)) return o.items;
    return [parsed];
  }
  return [];
}

/**
 * Mimica a fórmula de `dedup_hash` do DB (migration 0001):
 *   md5(coalesce(disciplina_id, '') || '||' ||
 *       coalesce(payload->>'enunciado', payload->>'enunciado_completo', ''))
 *
 * Crucial: SQL `coalesce` só pula NULL — strings vazias contam como
 * "valor presente". JS `||` trata '' como falsy. Antes, o cliente fazia
 * `enunciado || enunciado_completo` e considerava `enunciado:''` como
 * "ausente"; o DB considera presente. Resultado: cliente importava 100
 * discursivas com `enunciado:''` achando que eram únicas; DB rejeitava
 * 99 como duplicatas (todas com hash de `disc||''`). Bug real, descoberto
 * com 100 discursivas travadas em pendingSync.
 *
 * Esta função usa `?? ` que pula apenas null/undefined, e checa
 * `typeof === 'string'` pra capturar quando uma chave existe vs. não
 * existe — replicando fielmente o `payload->>'k'` do PostgreSQL.
 */
export function dedupeKey(
  q: Pick<Question, 'disciplina_id' | 'payload' | 'type'>
): string {
  const disc = q.disciplina_id ?? '';
  const p = q.payload as Record<string, unknown>;
  const enunRaw = pgJsonString(p, 'enunciado');
  const enunCompletoRaw = pgJsonString(p, 'enunciado_completo');
  const enun = enunRaw ?? enunCompletoRaw ?? '';
  return disc + '||' + enun;
}

/**
 * Imita `payload->>'key'` do PostgreSQL: retorna a string se a chave
 * existe e é uma string (incluindo ''), senão null. Não cobre números/bools
 * porque payloads de questões têm enunciado sempre como string.
 */
function pgJsonString(obj: Record<string, unknown>, key: string): string | null {
  const v = obj[key];
  return typeof v === 'string' ? v : null;
}

export function safeParseJSON(text: string): { value: unknown; error: string | null } {
  try {
    const cleaned = text.replace(/^﻿/, '').trim();
    return { value: JSON.parse(cleaned), error: null };
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'JSON inválido';
    return { value: null, error: msg };
  }
}
