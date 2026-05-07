/**
 * Helpers puros pra Fase C2 — snapshot filtrado de sharing.
 *
 * Lógica isolada (sanitização, geração de token, mascaramento de
 * email) pra ser testável sem mockar Supabase/network.
 */

import type { Question } from './types';

/**
 * Token unguessable pra link de share. Gera UUID v4 sem hífens (32
 * chars hex). Espaço de 2^128 — suficiente contra brute-force; a
 * camada de rate limit no endpoint pega tentativas em massa.
 *
 * Usa crypto.randomUUID() (disponível em Node 20+ e browsers modernos).
 * Cair pra fallback Math.random só quando totalmente indisponível —
 * NÃO use isso em prod sem alerta.
 */
export function generateShareToken(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID().replace(/-/g, '');
  }
  // Fallback inseguro — nunca deveria executar em prod (Node 20+ tem)
  console.warn('[sharing] crypto.randomUUID indisponível — fallback inseguro!');
  return Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
}

/**
 * Mascara email pra display público:
 *   "danielhcomerio@gmail.com" → "dani***@gmail.com"
 *   "ab@x.co" → "ab***@x.co"
 *   "a@b.c" → "a***@b.c"
 *   sem email: "Anônimo"
 *
 * Mantém parte local visível (até 4 chars), domínio inteiro. Permite
 * receptor reconhecer o owner se já conhece (colega de turma) sem
 * expor email completo pra stranger que recebe link encaminhado.
 */
export function maskEmail(email: string | null | undefined): string {
  if (!email || typeof email !== 'string') return 'Anônimo';
  const [local, domain] = email.split('@');
  if (!domain) return 'Anônimo';
  const visible = local.slice(0, Math.min(4, local.length));
  return `${visible}***@${domain}`;
}

/**
 * Sanitiza Question pra incluir no snapshot — remove campos pessoais
 * (srs/stats do owner) e ids que precisam ser regenerados pelo receptor.
 *
 * Mantém o conteúdo EDUCACIONAL: payload (enunciado, alternativas,
 * etc), disciplina_id, tema, tags, banca_estilo, dificuldade, origem,
 * fonte, verificacao. Tudo que faz a questão ser estudável.
 *
 * Remove:
 *  - id, user_id (regenerados na importação)
 *  - srs (estado de SRS é por-user)
 *  - stats (idem)
 *  - topico_id, concurso_id, disciplina_uuid (apontam pra entities
 *    do owner; receptor cria as suas se quiser)
 *  - created_at, updated_at, deleted_at (regenerados)
 *  - _dirty
 */
export type SharedQuestion = {
  type: Question['type'];
  disciplina_id: string | null;
  tema: string | null;
  banca_estilo: string | null;
  dificuldade: number | null;
  payload: Question['payload'];
  tags?: string[];
  origem?: Question['origem'];
  fonte?: Question['fonte'];
  verificacao?: Question['verificacao'];
};

export function sanitizeQuestionForShare(q: Question): SharedQuestion {
  return {
    type: q.type,
    disciplina_id: q.disciplina_id,
    tema: q.tema,
    banca_estilo: q.banca_estilo,
    dificuldade: q.dificuldade,
    payload: q.payload,
    ...(q.tags && q.tags.length > 0 ? { tags: q.tags } : {}),
    ...(q.origem ? { origem: q.origem } : {}),
    ...(q.fonte && Object.keys(q.fonte).length > 0 ? { fonte: q.fonte } : {}),
    ...(q.verificacao ? { verificacao: q.verificacao } : {}),
  };
}

/**
 * Aplica sanitização em batch. Usado quando owner gera o snapshot.
 */
export function sanitizeQuestionsForShare(
  questions: Question[]
): SharedQuestion[] {
  return questions.map(sanitizeQuestionForShare);
}

/**
 * Cap de quantas questões pode compartilhar de uma vez. Evita abuso
 * (compartilhar 100k de uma vez sobrecarrega o snapshot jsonb).
 * Mesmo número que o CHECK do DB (5000).
 */
export const MAX_QUESTIONS_PER_SHARE = 5000;

/**
 * Validação client-side antes de POST /api/share. Mesmas regras que
 * o backend aplica — defense em camadas.
 */
export function validateShareRequest(input: {
  questionIds: string[];
  expirationDays?: number;
}): { ok: true } | { ok: false; error: string } {
  if (!Array.isArray(input.questionIds) || input.questionIds.length === 0) {
    return { ok: false, error: 'Selecione ao menos 1 questão pra compartilhar.' };
  }
  if (input.questionIds.length > MAX_QUESTIONS_PER_SHARE) {
    return {
      ok: false,
      error: `Máximo ${MAX_QUESTIONS_PER_SHARE} questões por link. Selecione menos.`,
    };
  }
  if (input.expirationDays !== undefined) {
    // 36500 dias = 100 anos = "sem expiração" prática (UI usa esse
    // valor pra opção sem prazo). Cap evita valores absurdos
    // (negative, NaN, Infinity).
    if (
      typeof input.expirationDays !== 'number' ||
      !Number.isFinite(input.expirationDays) ||
      input.expirationDays < 1 ||
      input.expirationDays > 36500
    ) {
      return {
        ok: false,
        error: 'Expiração deve ser entre 1 dia e ~100 anos.',
      };
    }
  }
  return { ok: true };
}
