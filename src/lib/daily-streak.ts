/**
 * Cálculo de streak (consecutivo) e best streak a partir de uma lista
 * de datas em formato 'YYYY-MM-DD'. Usado pelo desafio diário.
 *
 * - currentStreak: dias consecutivos terminando em hoje (ou ontem se hoje
 *   ainda não foi feito — não quebra streak imediatamente).
 * - bestStreak: maior sequência consecutiva no histórico.
 *
 * Datas duplicadas são tratadas (Set internamente).
 */

const DAY_MS = 86400000;

function todayUTC(): string {
  return new Date().toISOString().slice(0, 10);
}

function yesterdayUTC(): string {
  return new Date(Date.now() - DAY_MS).toISOString().slice(0, 10);
}

function dateToMs(yyyymmdd: string): number {
  return Date.UTC(
    parseInt(yyyymmdd.slice(0, 4), 10),
    parseInt(yyyymmdd.slice(5, 7), 10) - 1,
    parseInt(yyyymmdd.slice(8, 10), 10)
  );
}

function msToDate(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

export function computeDailyStreak(
  dates: readonly string[],
  now: Date = new Date()
): { currentStreak: number; bestStreak: number } {
  if (dates.length === 0) {
    return { currentStreak: 0, bestStreak: 0 };
  }

  const set = new Set(dates.filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)));
  if (set.size === 0) {
    return { currentStreak: 0, bestStreak: 0 };
  }

  // current streak: começa em hoje, ou em ontem se hoje não tem
  const todayStr = now.toISOString().slice(0, 10);
  const yesterdayStr = new Date(now.getTime() - DAY_MS)
    .toISOString()
    .slice(0, 10);

  let cursor: string;
  if (set.has(todayStr)) cursor = todayStr;
  else if (set.has(yesterdayStr)) cursor = yesterdayStr;
  else return { currentStreak: 0, bestStreak: computeBest(set) };

  let currentStreak = 0;
  let cursorMs = dateToMs(cursor);
  while (set.has(msToDate(cursorMs))) {
    currentStreak++;
    cursorMs -= DAY_MS;
  }

  return { currentStreak, bestStreak: computeBest(set) };
}

function computeBest(set: Set<string>): number {
  const sorted = Array.from(set).sort();
  if (sorted.length === 0) return 0;
  let best = 1;
  let cur = 1;
  let prevMs = dateToMs(sorted[0]);
  for (let i = 1; i < sorted.length; i++) {
    const curMs = dateToMs(sorted[i]);
    if (curMs - prevMs === DAY_MS) {
      cur++;
      if (cur > best) best = cur;
    } else {
      cur = 1;
    }
    prevMs = curMs;
  }
  return best;
}

// Re-exports privados pra teste
export const __test = { todayUTC, yesterdayUTC };
