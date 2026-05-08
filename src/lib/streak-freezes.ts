'use client';

/**
 * Streak insurance: user ganha "freezes" (gelos) que protegem o streak
 * contra dias vazios.
 *
 * Regras:
 * - 1 freeze ganho a cada 7 dias seguidos estudando.
 * - 1 freeze bonus por simulado finalizado (max 1/dia).
 * - Cap total: 3 freezes simultâneos (incentiva usar, não acumular).
 * - Freeze é consumido AUTOMATICAMENTE no fim de um dia vazio se o
 *   user tinha streak ativo ontem; preserva streak.
 *
 * Storage: localStorage (não sincroniza — per-device, like settings).
 *
 *   `estudo-simples:streak-freezes:v1` =
 *     {
 *       count: number,            // estoque atual de freezes
 *       earnedDates: string[],    // YYYY-MM-DD em que foi ganho
 *       usedDates: string[],      // YYYY-MM-DD em que foi consumido
 *     }
 */

const KEY = 'estudo-simples:streak-freezes:v1';
const MAX = 3;

const DAY_MS = 86400000;

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function yesterdayKey(): string {
  return new Date(Date.now() - DAY_MS).toISOString().slice(0, 10);
}

export type FreezeState = {
  count: number;
  earnedDates: string[];
  usedDates: string[];
};

function defaultState(): FreezeState {
  return { count: 0, earnedDates: [], usedDates: [] };
}

export function readFreezes(): FreezeState {
  if (typeof window === 'undefined') return defaultState();
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaultState();
    const j = JSON.parse(raw);
    if (
      typeof j === 'object' &&
      typeof j.count === 'number' &&
      Array.isArray(j.earnedDates) &&
      Array.isArray(j.usedDates)
    ) {
      return {
        count: Math.max(0, Math.min(MAX, j.count)),
        // earnedDates aceita YYYY-MM-DD OU sentinelas: 'streak-milestone-N'
        // / 'simulado-YYYY-MM-DD' (ver maybeEarnFrom*). Filtro abaixo
        // permite ambos formatos pra preservar idempotência.
        earnedDates: j.earnedDates.filter(
          (d: unknown) =>
            typeof d === 'string' &&
            (/^\d{4}-\d{2}-\d{2}$/.test(d) ||
              d.startsWith('streak-milestone-') ||
              d.startsWith('simulado-'))
        ),
        usedDates: j.usedDates.filter(
          (d: unknown) => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d)
        ),
      };
    }
  } catch {
    /* ignore */
  }
  return defaultState();
}

function writeFreezes(s: FreezeState): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* ignore */
  }
}

/**
 * Verifica se user merece ganhar freezes baseado no streak atual.
 * Regra: a cada 7 dias seguidos, 1 freeze. Mas só conta cada milestone
 * uma vez (não dá freeze duplicado pra mesmo streak).
 *
 * Marker: armazena lastEarnedAtStreak no campo earnedDates como
 * sentinela "via-streak-N" — sim, gambiarra, mas evita migrar schema.
 *
 * @param currentStreak streak atual
 * @returns número de freezes adicionados (0 se já reivindicou ou cap)
 */
export function maybeEarnFromStreak(currentStreak: number): number {
  const milestone = Math.floor(currentStreak / 7);
  if (milestone === 0) return 0;
  const state = readFreezes();
  // Marker sintético — guarda quantos milestones ja foram pagos
  const paidMilestones = state.earnedDates.filter((d) =>
    d.startsWith('streak-milestone-')
  ).length;
  if (paidMilestones >= milestone) return 0;
  if (state.count >= MAX) return 0;
  const toAdd = Math.min(MAX - state.count, milestone - paidMilestones);
  state.count += toAdd;
  for (let i = 0; i < toAdd; i++) {
    state.earnedDates.push(`streak-milestone-${paidMilestones + i + 1}`);
  }
  state.earnedDates.push(todayKey());
  writeFreezes(state);
  return toAdd;
}

/**
 * Ganha 1 freeze por simulado finalizado (max 1/dia).
 */
export function maybeEarnFromSimulado(): number {
  const state = readFreezes();
  if (state.count >= MAX) return 0;
  const today = todayKey();
  if (state.earnedDates.includes(`simulado-${today}`)) return 0;
  state.count++;
  state.earnedDates.push(`simulado-${today}`);
  writeFreezes(state);
  return 1;
}

/**
 * Consome um freeze pra cobrir um "buraco" no streak.
 * Retorna true se conseguiu (count > 0).
 *
 * Chamar quando detectar que ontem foi vazio mas streak deveria
 * continuar.
 */
export function consumeFreeze(forDate: string = yesterdayKey()): boolean {
  const state = readFreezes();
  if (state.count <= 0) return false;
  if (state.usedDates.includes(forDate)) return false;
  state.count--;
  state.usedDates.push(forDate);
  writeFreezes(state);
  return true;
}

/**
 * Helper UI: descrição amigável das regras pra mostrar no Painel.
 */
export function freezesInfo(): string {
  const s = readFreezes();
  if (s.count === 0) {
    return 'Estude 7 dias seguidos pra ganhar 1 gelo (protege streak em dia vazio).';
  }
  return `Você tem ${s.count} gelo${s.count > 1 ? 's' : ''} de streak. Eles protegem 1 dia vazio cada.`;
}
