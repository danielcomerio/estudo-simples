/**
 * Forecast simples baseado em rolling average de revisões/dia.
 *
 * Pega N dias recentes (default 14), calcula média de revisões/dia,
 * projeta linear até atingir a meta. Não usa series-time fancy
 * (Holt-Winters etc.) — média simples já é boa proxy pra app de
 * estudo individual e fácil de explicar.
 *
 * Pure — testável sem mocks.
 */

const DAY_MS = 86400000;

export type ForecastInput = {
  /** Eventos de revisão (timestamps em ms). */
  reviewDates: readonly number[];
  /** Total atual de revisões. */
  currentCount: number;
  /** Quantas revisões mais o user quer atingir. */
  targetCount: number;
  /** Janela de média (default 14 dias). */
  windowDays?: number;
  /** Now (pra testes). */
  now?: number;
};

export type ForecastResult = {
  /** Média de revisões/dia na janela. */
  avgPerDay: number;
  /** Dias estimados pra atingir target. null se avg=0. */
  daysToTarget: number | null;
  /** ISO da data prevista (sem hora). null se daysToTarget=null. */
  targetDate: string | null;
  /** Mensagem amigável. */
  summary: string;
};

export function computeForecast({
  reviewDates,
  currentCount,
  targetCount,
  windowDays = 14,
  now = Date.now(),
}: ForecastInput): ForecastResult {
  if (targetCount <= currentCount) {
    return {
      avgPerDay: 0,
      daysToTarget: 0,
      targetDate: new Date(now).toISOString().slice(0, 10),
      summary: 'Meta já atingida 🎉',
    };
  }

  const cutoff = now - windowDays * DAY_MS;
  const inWindow = reviewDates.filter((d) => d >= cutoff && d <= now);
  const avgPerDay = inWindow.length / windowDays;

  if (avgPerDay <= 0) {
    return {
      avgPerDay: 0,
      daysToTarget: null,
      targetDate: null,
      summary:
        'Nenhuma revisão na janela recente — comece a estudar pra ter previsão.',
    };
  }

  const remaining = targetCount - currentCount;
  const daysToTarget = Math.ceil(remaining / avgPerDay);
  const targetMs = now + daysToTarget * DAY_MS;
  const targetDate = new Date(targetMs).toISOString().slice(0, 10);

  let summary: string;
  if (daysToTarget <= 7) {
    summary = `Faltam ${remaining} revisões. Mantendo ${avgPerDay.toFixed(1)}/dia, atinge em ~${daysToTarget} dia(s).`;
  } else if (daysToTarget <= 90) {
    summary = `Faltam ${remaining} revisões. Mantendo ${avgPerDay.toFixed(1)}/dia, atinge em ~${daysToTarget} dias (${formatBR(targetDate)}).`;
  } else {
    summary = `Faltam ${remaining} revisões. Ritmo atual leva ~${daysToTarget} dias (${formatBR(targetDate)}). Aumentar pra ${(avgPerDay * 2).toFixed(1)}/dia cortaria pela metade.`;
  }

  return { avgPerDay, daysToTarget, targetDate, summary };
}

function formatBR(yyyymmdd: string): string {
  const [y, m, d] = yyyymmdd.split('-');
  return `${d}/${m}/${y}`;
}
