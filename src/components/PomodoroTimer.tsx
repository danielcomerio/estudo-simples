'use client';

import { useEffect, useReducer, useState } from 'react';
import { usePathname } from 'next/navigation';
import { toast } from './Toast';
import { playSound } from '@/lib/sounds';
import { isNotificationsEnabled } from '@/lib/notifications';

const STORAGE_KEY = 'estudo-simples:pomodoro:v2';
const SETTINGS_KEY = 'estudo-simples:pomodoro:settings:v1';
const STATS_KEY = 'estudo-simples:pomodoro:stats:v1';

/** Registra timestamp de pomodoro completo. Mantém últimos 200 (~50 dias). */
function recordCompleted(): void {
  if (typeof window === 'undefined') return;
  try {
    const raw = localStorage.getItem(STATS_KEY);
    const arr: number[] = raw ? JSON.parse(raw) : [];
    arr.push(Date.now());
    const trimmed = arr.slice(-200);
    localStorage.setItem(STATS_KEY, JSON.stringify(trimmed));
  } catch {}
}

function loadStats(): { today: number; week: number; total: number } {
  if (typeof window === 'undefined') return { today: 0, week: 0, total: 0 };
  try {
    const raw = localStorage.getItem(STATS_KEY);
    if (!raw) return { today: 0, week: 0, total: 0 };
    const arr: number[] = JSON.parse(raw);
    if (!Array.isArray(arr)) return { today: 0, week: 0, total: 0 };
    const now = Date.now();
    const today0 = new Date(now);
    today0.setHours(0, 0, 0, 0);
    const todayMs = today0.getTime();
    const week0Ms = todayMs - 6 * 86400000;
    let today = 0;
    let week = 0;
    for (const t of arr) {
      if (typeof t !== 'number') continue;
      if (t >= todayMs) today++;
      if (t >= week0Ms) week++;
    }
    return { today, week, total: arr.length };
  } catch {
    return { today: 0, week: 0, total: 0 };
  }
}

type Phase = 'focus' | 'short_break' | 'long_break';

type Settings = {
  focusMin: number;
  shortBreakMin: number;
  longBreakMin: number;
  longBreakEvery: number;
};

const DEFAULT_SETTINGS: Settings = {
  focusMin: 25,
  shortBreakMin: 5,
  longBreakMin: 15,
  longBreakEvery: 4,
};

type Persisted = {
  phase: Phase;
  endsAt: number;
  paused: boolean;
  remainingMs?: number;
  /** Quantos focos completos no ciclo atual (reset depois de long_break) */
  cycleCount: number;
};

function loadSettings(): Settings {
  if (typeof window === 'undefined') return DEFAULT_SETTINGS;
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw);
    return {
      focusMin: clamp(+parsed.focusMin || 25, 1, 120),
      shortBreakMin: clamp(+parsed.shortBreakMin || 5, 1, 60),
      longBreakMin: clamp(+parsed.longBreakMin || 15, 1, 60),
      longBreakEvery: clamp(+parsed.longBreakEvery || 4, 2, 12),
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function saveSettings(s: Settings) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
  } catch {}
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

function loadState(): Persisted | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw);
    if (
      p &&
      (p.phase === 'focus' || p.phase === 'short_break' || p.phase === 'long_break') &&
      typeof p.endsAt === 'number'
    ) {
      return {
        phase: p.phase,
        endsAt: p.endsAt,
        paused: !!p.paused,
        remainingMs: p.remainingMs,
        cycleCount: typeof p.cycleCount === 'number' ? p.cycleCount : 0,
      };
    }
  } catch {}
  return null;
}

function saveState(p: Persisted | null) {
  if (typeof window === 'undefined') return;
  try {
    if (p === null) localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
  } catch {}
}

/**
 * Formata ms → "MM:SS". Usa floor (não ceil) pra que o segundo "x" seja
 * mostrado durante o intervalo [x*1000, (x+1)*1000) — comportamento
 * intuitivo (ao iniciar com 25min mostra 25:00, não 25:01).
 */
function fmt(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

const PHASE_LABEL: Record<Phase, string> = {
  focus: 'Foco',
  short_break: 'Pausa curta',
  long_break: 'Pausa longa',
};
const PHASE_EMOJI: Record<Phase, string> = {
  focus: '🍅',
  short_break: '☕',
  long_break: '🌴',
};
const PHASE_COLOR: Record<Phase, string> = {
  focus: 'var(--primary)',
  short_break: 'var(--warn, #d97706)',
  long_break: '#3b82f6',
};

/**
 * Pomodoro flutuante. Ciclo automático: foco → pausa curta → foco →
 * pausa curta → ... → após N focos, pausa longa.
 *
 * Bug fix vs v1: o tempo de início mostrava "25:XX" porque o estado
 * `now` era um snapshot antigo. v2 calcula direto com `Date.now()` no
 * render — sem fontes de defasagem.
 */
export function PomodoroTimer() {
  const pathname = usePathname();
  // Em rotas de sessão, mantém o widget bem discreto (só botão circular)
  // pra não cobrir rate buttons sticky no fundo. User pode expandir.
  const inSession =
    pathname?.startsWith('/estudar') ||
    pathname?.startsWith('/cards') ||
    pathname?.startsWith('/discursivas') ||
    pathname?.startsWith('/simulado');

  const [persisted, setPersisted] = useState<Persisted | null>(null);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [expanded, setExpanded] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  // Force re-render a cada segundo. NÃO usamos `now` state — Date.now()
  // direto no render evita defasagem.
  const [, tick] = useReducer((x: number) => x + 1, 0);

  useEffect(() => {
    setPersisted(loadState());
    setSettings(loadSettings());
  }, []);

  // Re-render a cada segundo se há fase ativa não pausada
  useEffect(() => {
    if (!persisted || persisted.paused) return;
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [persisted]);

  // Auto-transição quando uma fase termina
  useEffect(() => {
    if (!persisted || persisted.paused) return;
    const remaining = persisted.endsAt - Date.now();
    if (remaining > 0) {
      const t = setTimeout(() => transition(), remaining + 50);
      return () => clearTimeout(t);
    }
    transition();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [persisted, settings]);

  const notifyEnd = (title: string, body: string) => {
    // Som curto se sounds habilitado
    playSound('success');
    // Notification system se habilitado e aba não-visível
    if (
      isNotificationsEnabled() &&
      typeof document !== 'undefined' &&
      document.visibilityState !== 'visible'
    ) {
      try {
        new Notification(title, {
          body,
          icon: '/icon.svg',
          tag: 'pomodoro',
          // @ts-expect-error vibrate funciona em Android
          vibrate: [60, 40, 60],
        });
      } catch {}
    }
  };

  const transition = () => {
    if (!persisted) return;
    if (persisted.phase === 'focus') {
      // Registra pomodoro completo nas estatísticas
      recordCompleted();
      const newCycle = persisted.cycleCount + 1;
      const nextPhase: Phase =
        newCycle >= settings.longBreakEvery ? 'long_break' : 'short_break';
      const dur =
        nextPhase === 'long_break'
          ? settings.longBreakMin * 60_000
          : settings.shortBreakMin * 60_000;
      const next: Persisted = {
        phase: nextPhase,
        endsAt: Date.now() + dur,
        paused: false,
        cycleCount: nextPhase === 'long_break' ? 0 : newCycle,
      };
      setPersisted(next);
      saveState(next);
      const msg =
        nextPhase === 'long_break'
          ? `🌴 Pausa longa de ${settings.longBreakMin}min — você completou ${settings.longBreakEvery} focos!`
          : `☕ Pausa de ${settings.shortBreakMin}min começou`;
      toast(msg, 'success');
      notifyEnd('Pomodoro: foco completo', msg);
    } else {
      // Pausa terminou — começa próximo foco automaticamente
      const next: Persisted = {
        phase: 'focus',
        endsAt: Date.now() + settings.focusMin * 60_000,
        paused: false,
        cycleCount: persisted.cycleCount,
      };
      setPersisted(next);
      saveState(next);
      const msg = `🍅 Foco de ${settings.focusMin}min iniciado`;
      toast(msg, 'success');
      notifyEnd('Pomodoro: pausa terminou', msg);
    }
  };

  const startFocus = () => {
    const p: Persisted = {
      phase: 'focus',
      endsAt: Date.now() + settings.focusMin * 60_000,
      paused: false,
      cycleCount: 0,
    };
    setPersisted(p);
    saveState(p);
    setExpanded(true);
  };

  const togglePause = () => {
    if (!persisted) return;
    if (persisted.paused) {
      const remaining = persisted.remainingMs ?? 0;
      const next: Persisted = {
        ...persisted,
        endsAt: Date.now() + remaining,
        paused: false,
        remainingMs: undefined,
      };
      setPersisted(next);
      saveState(next);
    } else {
      const remaining = Math.max(0, persisted.endsAt - Date.now());
      const next: Persisted = {
        ...persisted,
        paused: true,
        remainingMs: remaining,
      };
      setPersisted(next);
      saveState(next);
    }
  };

  const stop = () => {
    setPersisted(null);
    saveState(null);
  };

  const skip = () => {
    if (!persisted) return;
    // Marca como ja-acabado pra disparar transição
    const next: Persisted = { ...persisted, endsAt: Date.now(), paused: false };
    setPersisted(next);
    saveState(next);
  };

  // ============ Renderização ============
  // Em sessão sem timer ativo, esconde completamente — pomodoro só faz
  // sentido se o user iniciou um. Voltar pro Painel pra começar.
  if (inSession && !persisted) return null;

  if (!persisted) {
    if (!expanded) {
      return (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          aria-label="Abrir Pomodoro"
          title="Pomodoro"
          style={{
            position: 'fixed',
            left: 16,
            bottom: 16,
            zIndex: 35,
            width: 40,
            height: 40,
            borderRadius: '50%',
            border: '1px solid var(--border)',
            background: 'var(--bg-elev)',
            color: 'var(--text)',
            cursor: 'pointer',
            fontSize: '1rem',
            opacity: 0.6,
          }}
        >
          🍅
        </button>
      );
    }
    return (
      <div
        className="pomodoro-widget"
        style={{
          position: 'fixed',
          left: 16,
          bottom: 16,
          zIndex: 35,
          background: 'var(--bg-elev)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius)',
          padding: '10px 12px',
          boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
          fontSize: '0.88rem',
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
          minWidth: 220,
          maxWidth: 'calc(100vw - 32px)',
          maxHeight: 'calc(100vh - 32px)',
          overflowY: 'auto',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span>🍅 Pomodoro</span>
          <span className="muted" style={{ fontSize: '0.78rem' }}>
            {settings.focusMin}/{settings.shortBreakMin}/{settings.longBreakMin}min
          </span>
          {(() => {
            const stats = loadStats();
            if (stats.total === 0) return null;
            return (
              <span
                className="muted"
                style={{ fontSize: '0.74rem' }}
                title={`Hoje: ${stats.today} · Esta semana: ${stats.week} · Total: ${stats.total}`}
              >
                · {stats.today}🔥
              </span>
            );
          })()}
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
            <button
              type="button"
              className="ghost icon"
              onClick={() => setShowSettings((v) => !v)}
              aria-label="Configurações"
              title="Configurar"
            >
              ⚙
            </button>
            <button
              type="button"
              className="ghost icon"
              onClick={() => setExpanded(false)}
              aria-label="Fechar"
              title="Fechar"
            >
              ✕
            </button>
          </div>
        </div>

        {showSettings ? (
          <PomoSettingsForm
            initial={settings}
            onSave={(s) => {
              setSettings(s);
              saveSettings(s);
              setShowSettings(false);
              toast('Pomodoro atualizado', 'success');
            }}
            onCancel={() => setShowSettings(false)}
          />
        ) : (
          <button
            type="button"
            className="primary"
            onClick={startFocus}
            style={{ padding: '8px 12px', fontSize: '0.92rem' }}
          >
            ▶ Começar foco {settings.focusMin}min
          </button>
        )}
      </div>
    );
  }

  // Sessão ativa — calcula remaining direto de Date.now() pra não ter
  // defasagem do tick / state stale.
  const remaining = persisted.paused
    ? persisted.remainingMs ?? 0
    : Math.max(0, persisted.endsAt - Date.now());
  const phase = persisted.phase;
  const totalDur =
    phase === 'focus'
      ? settings.focusMin * 60_000
      : phase === 'short_break'
        ? settings.shortBreakMin * 60_000
        : settings.longBreakMin * 60_000;
  const pct = Math.max(0, Math.min(100, 100 - (100 * remaining) / totalDur));

  return (
    <div
      role="status"
      aria-live="off"
      className="pomodoro-widget"
      style={{
        position: 'fixed',
        left: 16,
        bottom: 16,
        zIndex: 35,
        background: 'var(--bg-elev)',
        border: `1px solid ${PHASE_COLOR[phase]}`,
        borderRadius: 'var(--radius)',
        padding: '10px 14px',
        boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
        fontVariantNumeric: 'tabular-nums',
        minWidth: 200,
        maxWidth: 'calc(100vw - 32px)',
        maxHeight: 'calc(100vh - 96px)',
        overflowY: 'auto',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}
      >
        <span aria-hidden style={{ fontSize: '1.4rem' }}>
          {PHASE_EMOJI[phase]}
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: '0.74rem',
              opacity: 0.75,
              color: PHASE_COLOR[phase],
              fontWeight: 500,
              display: 'flex',
              gap: 6,
              alignItems: 'center',
            }}
          >
            {PHASE_LABEL[phase]}
            {persisted.paused && (
              <span
                style={{
                  background: 'var(--bg-elev-2)',
                  padding: '0px 5px',
                  borderRadius: 4,
                  fontSize: '0.72rem',
                }}
              >
                pausado
              </span>
            )}
            {phase === 'focus' && persisted.cycleCount > 0 && (
              <span style={{ opacity: 0.6 }}>
                · {persisted.cycleCount}/{settings.longBreakEvery}
              </span>
            )}
          </div>
          <div style={{ fontSize: '1.4rem', fontWeight: 600, lineHeight: 1.1 }}>
            {fmt(remaining)}
          </div>
        </div>
        <button
          type="button"
          className="ghost icon"
          onClick={togglePause}
          title={persisted.paused ? 'Retomar' : 'Pausar'}
          aria-label={persisted.paused ? 'Retomar' : 'Pausar'}
        >
          {persisted.paused ? '▶' : '⏸'}
        </button>
        <button
          type="button"
          className="ghost icon"
          onClick={skip}
          title="Pular pra próxima fase"
          aria-label="Pular"
        >
          ⏭
        </button>
        <button
          type="button"
          className="ghost icon"
          onClick={stop}
          title="Encerrar"
          aria-label="Encerrar"
        >
          ✕
        </button>
      </div>
      {/* Barra de progresso */}
      <div
        aria-hidden
        style={{
          height: 3,
          background: 'var(--bg-elev-2)',
          borderRadius: 2,
          overflow: 'hidden',
          marginTop: 8,
        }}
      >
        <div
          style={{
            height: '100%',
            width: `${pct}%`,
            background: PHASE_COLOR[phase],
            transition: 'width 0.6s linear',
          }}
        />
      </div>
    </div>
  );
}

function PomoSettingsForm({
  initial,
  onSave,
  onCancel,
}: {
  initial: Settings;
  onSave: (s: Settings) => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState(initial);
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        fontSize: '0.82rem',
      }}
    >
      <NumField
        label="Foco (min)"
        value={draft.focusMin}
        min={1}
        max={120}
        onChange={(v) => setDraft({ ...draft, focusMin: v })}
      />
      <NumField
        label="Pausa curta (min)"
        value={draft.shortBreakMin}
        min={1}
        max={60}
        onChange={(v) => setDraft({ ...draft, shortBreakMin: v })}
      />
      <NumField
        label="Pausa longa (min)"
        value={draft.longBreakMin}
        min={1}
        max={60}
        onChange={(v) => setDraft({ ...draft, longBreakMin: v })}
      />
      <NumField
        label="Pausa longa a cada N focos"
        value={draft.longBreakEvery}
        min={2}
        max={12}
        onChange={(v) => setDraft({ ...draft, longBreakEvery: v })}
      />
      <div className="row gap" style={{ marginTop: 4 }}>
        <button
          type="button"
          className="primary"
          onClick={() => onSave(draft)}
          style={{ padding: '6px 12px', fontSize: '0.85rem' }}
        >
          Salvar
        </button>
        <button
          type="button"
          className="ghost"
          onClick={onCancel}
          style={{ padding: '6px 12px', fontSize: '0.85rem' }}
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}

function NumField({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
}) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <span style={{ flex: 1, fontSize: '0.82rem' }}>{label}</span>
      <input
        type="number"
        min={min}
        max={max}
        value={value}
        onChange={(e) =>
          onChange(clamp(parseInt(e.target.value) || min, min, max))
        }
        style={{ width: 64, fontSize: '0.85rem', padding: '3px 6px' }}
      />
    </label>
  );
}
