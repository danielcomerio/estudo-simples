/**
 * Lib pra AI Coach — chat global com contexto do user.
 *
 * Responsabilidades:
 *  - Persistência de histórico (localStorage por device, key única).
 *  - Construção de contexto system: concurso ativo, disciplinas fracas,
 *    questões inimigas, preferências.
 */

import type { Question } from './types';

const KEY = 'estudo-simples:coach-history-v1';
const MAX_TURNS = 30;
const MAX_BYTES = 80_000;

export type CoachMessage = {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
};

export function getCoachHistory(): CoachMessage[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (m): m is CoachMessage =>
        m &&
        typeof m === 'object' &&
        (m.role === 'user' || m.role === 'assistant') &&
        typeof m.content === 'string' &&
        typeof m.timestamp === 'number'
    );
  } catch {
    return [];
  }
}

export function saveCoachHistory(messages: CoachMessage[]): void {
  if (typeof window === 'undefined') return;
  try {
    let trimmed = messages.slice(-MAX_TURNS * 2);
    let serialized = JSON.stringify(trimmed);
    while (serialized.length > MAX_BYTES && trimmed.length > 2) {
      trimmed = trimmed.slice(2);
      serialized = JSON.stringify(trimmed);
    }
    window.localStorage.setItem(KEY, serialized);
  } catch {
    /* ignore */
  }
}

export function clearCoachHistory(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

/**
 * Constrói contexto compacto do user a partir das questions hidratadas.
 * Inclui: total no banco, dominadas, inimigas top 3, disciplinas fracas
 * top 3, banca dominante, concurso ativo (passado por arg).
 *
 * Cap em ~1500 chars pra não inflar prompt em todo turn.
 */
export function buildUserContext(
  questions: Question[],
  activeConcursoNome: string | null
): string {
  if (questions.length === 0) {
    return 'O usuário ainda não tem questões no banco.';
  }

  let totalAttempts = 0;
  let totalCorrect = 0;
  let dominadas = 0;
  const discStats = new Map<string, { att: number; correct: number }>();
  const inimigas: Array<{ tema: string; pct: number; att: number }> = [];
  const bancaCount = new Map<string, number>();

  for (const q of questions) {
    const att = q.stats?.attempts ?? 0;
    const cor = q.stats?.correct ?? 0;
    totalAttempts += att;
    totalCorrect += cor;
    const h = q.stats?.history ?? [];
    if (
      h.length >= 5 &&
      h.slice(-5).every((r) => r.result === 'correct' || r.result === 'self_pass')
    ) {
      dominadas++;
    }
    if (att >= 3 && cor / att < 0.3) {
      inimigas.push({
        tema: q.tema || q.disciplina_id || 'sem-tema',
        pct: Math.round((cor / att) * 100),
        att,
      });
    }
    const disc = q.disciplina_id?.trim();
    if (disc && att > 0) {
      const cur = discStats.get(disc) ?? { att: 0, correct: 0 };
      cur.att += att;
      cur.correct += cor;
      discStats.set(disc, cur);
    }
    if (q.banca_estilo) {
      bancaCount.set(
        q.banca_estilo,
        (bancaCount.get(q.banca_estilo) ?? 0) + 1
      );
    }
  }

  const pctGeral =
    totalAttempts > 0 ? Math.round((100 * totalCorrect) / totalAttempts) : 0;

  // Top 3 disciplinas fracas (com >=10 attempts)
  const fracas = Array.from(discStats.entries())
    .filter(([, s]) => s.att >= 10)
    .map(([d, s]) => ({ disc: d, pct: Math.round((100 * s.correct) / s.att) }))
    .sort((a, b) => a.pct - b.pct)
    .slice(0, 3);

  const topInimigas = inimigas
    .sort((a, b) => a.pct - b.pct)
    .slice(0, 3);

  const topBanca =
    Array.from(bancaCount.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ??
    null;

  const parts: string[] = [];
  parts.push(
    `Banco: ${questions.length} questões. ${dominadas} dominadas. ${pctGeral}% acerto geral em ${totalAttempts} revisões.`
  );
  if (activeConcursoNome) {
    parts.push(`Concurso ativo: ${activeConcursoNome}.`);
  }
  if (topBanca) {
    parts.push(`Banca dominante no banco: ${topBanca}.`);
  }
  if (fracas.length > 0) {
    parts.push(
      `Disciplinas mais fracas: ${fracas.map((f) => `${f.disc} (${f.pct}%)`).join(', ')}.`
    );
  }
  if (topInimigas.length > 0) {
    parts.push(
      `Questões "inimigas" (acerto < 30%): ${topInimigas.map((i) => `${i.tema} (${i.pct}%)`).join('; ')}.`
    );
  }

  return parts.join(' ').slice(0, 1500);
}

/**
 * Monta prompt completo: system (persona) + contexto + histórico + nova msg.
 * Como /api/ai/chat aceita prompt único string, concatenamos tudo.
 */
export function buildCoachPrompt(
  systemPrompt: string,
  userContext: string,
  history: CoachMessage[]
): string {
  const turns = history
    .map((m) =>
      m.role === 'user' ? `Usuário: ${m.content}` : `Você: ${m.content}`
    )
    .join('\n\n');

  return `${systemPrompt}

CONTEXTO DO USUÁRIO:
${userContext}

CONVERSA ATÉ AGORA:
${turns}

Continue como "Você:". Responda direto, em pt-BR, sem cabeçalho. Use no máximo 300 palavras por resposta.`;
}

export const DEFAULT_COACH_PROMPT =
  'Você é o coach de estudos do usuário, focado em concursos públicos brasileiros. Seu papel: tirar dúvidas, sugerir plano de estudo baseado nas fraquezas dele, motivar nos momentos certos, e dar dicas concretas de banca/disciplina. Tom: direto, didático, encorajador mas honesto. Em pt-BR. Sem floreio.';
