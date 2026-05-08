/**
 * Detector de padrões de sessão para insights ao vivo.
 *
 * Roda LOCAL (sem IA) — detecta padrões e devolve mensagem curta.
 * Padrões cobertos:
 *  - "Hot streak": 5 acertos seguidos → reforça motivação.
 *  - "Cold streak": 3 erros seguidos → sugere pausa OU mudança de disciplina.
 *  - "Slump por disciplina": 2+ erros na mesma disciplina em 5 últimas →
 *    sugere foco em revisão dessa disciplina.
 *  - "Velocidade caindo": tempo médio última 5 vs 5 anteriores +30% →
 *    sugere pausa.
 *
 * Cada padrão tem `cooldownMs` — evita spammar quem já viu o insight.
 */

export type SessionEvent = {
  questionId: string;
  disciplina: string | null;
  isCorrect: boolean;
  durationMs: number;
  at: number;
};

export type Insight = {
  kind: 'hot' | 'cold' | 'slump' | 'slow';
  text: string;
  disciplina?: string;
};

export type InsightDetectorState = {
  events: SessionEvent[];
  shownAt: Map<string, number>;
};

export function createInsightState(): InsightDetectorState {
  return { events: [], shownAt: new Map() };
}

const COOLDOWN_MS = 5 * 60_000;

export function pushAndDetect(
  state: InsightDetectorState,
  ev: SessionEvent
): Insight | null {
  state.events.push(ev);
  if (state.events.length > 30) state.events.shift();

  const recent = state.events.slice(-5);
  const last3 = state.events.slice(-3);

  // Hot streak — 5 acertos consecutivos
  if (recent.length === 5 && recent.every((e) => e.isCorrect)) {
    return tryShow(state, 'hot', {
      kind: 'hot',
      text: '🔥 5 acertos seguidos. Mantenha o foco — você está num pico de retenção.',
    });
  }

  // Cold streak — 3 erros consecutivos
  if (last3.length === 3 && last3.every((e) => !e.isCorrect)) {
    return tryShow(state, 'cold', {
      kind: 'cold',
      text: '❄ 3 erros seguidos. Considere uma pausa de 2 min ou mudar de disciplina pra resetar.',
    });
  }

  // Slump por disciplina — 2 erros em últimos 5 da mesma disciplina
  const byDisc: Record<string, { wrong: number; total: number }> = {};
  for (const e of state.events.slice(-5)) {
    if (!e.disciplina) continue;
    const b = byDisc[e.disciplina] ?? { wrong: 0, total: 0 };
    b.total++;
    if (!e.isCorrect) b.wrong++;
    byDisc[e.disciplina] = b;
  }
  for (const [d, b] of Object.entries(byDisc)) {
    if (b.wrong >= 2 && b.total >= 3) {
      return tryShow(state, `slump-${d}`, {
        kind: 'slump',
        disciplina: d,
        text: `📉 Você errou ${b.wrong} de ${b.total} em ${d}. Vale revisar antes de seguir.`,
      });
    }
  }

  // Slow — última 3 com 30% mais tempo que 3 anteriores
  if (state.events.length >= 6) {
    const last3 = state.events.slice(-3);
    const prev3 = state.events.slice(-6, -3);
    const avg = (xs: SessionEvent[]) =>
      xs.reduce((a, b) => a + b.durationMs, 0) / xs.length;
    const a = avg(last3);
    const b = avg(prev3);
    if (b > 0 && a > b * 1.3 && a > 30_000) {
      return tryShow(state, 'slow', {
        kind: 'slow',
        text: '🐢 Velocidade caindo. Sinal de cansaço — considere uma pausa curta.',
      });
    }
  }

  return null;
}

function tryShow(
  state: InsightDetectorState,
  key: string,
  insight: Insight
): Insight | null {
  const last = state.shownAt.get(key) ?? 0;
  if (Date.now() - last < COOLDOWN_MS) return null;
  state.shownAt.set(key, Date.now());
  return insight;
}
