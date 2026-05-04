'use client';

import { useEffect, useRef, useState } from 'react';
import { toast } from './Toast';

const STORAGE_KEY = 'estudo-simples:pomodoro:v1';
const FOCUS_MIN = 25;
const BREAK_MIN = 5;

type Phase = 'focus' | 'break';
type Persisted = {
  phase: Phase;
  endsAt: number; // timestamp ms
  paused: boolean;
  remainingMs?: number; // populado quando paused=true
};

function load(): Persisted | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && (parsed.phase === 'focus' || parsed.phase === 'break')) {
      return parsed;
    }
  } catch {}
  return null;
}

function save(p: Persisted | null) {
  if (typeof window === 'undefined') return;
  try {
    if (p === null) localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
  } catch {}
}

function fmt(ms: number) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/**
 * Pomodoro flutuante (canto inferior esquerdo). 25 min foco / 5 min
 * pausa. Persiste em localStorage — sobrevive a refresh. Toast quando
 * cada fase termina.
 */
export function PomodoroTimer() {
  const [persisted, setPersisted] = useState<Persisted | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [expanded, setExpanded] = useState(false);
  const transitionedRef = useRef<number | null>(null);

  // Hidrata estado salvo
  useEffect(() => {
    setPersisted(load());
  }, []);

  // Tick (só roda quando há ciclo ativo)
  useEffect(() => {
    if (!persisted || persisted.paused) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [persisted]);

  // Detecta transição de fase
  useEffect(() => {
    if (!persisted || persisted.paused) return;
    const remaining = persisted.endsAt - now;
    if (remaining > 0) return;
    if (transitionedRef.current === persisted.endsAt) return;
    transitionedRef.current = persisted.endsAt;

    if (persisted.phase === 'focus') {
      const next: Persisted = {
        phase: 'break',
        endsAt: now + BREAK_MIN * 60_000,
        paused: false,
      };
      setPersisted(next);
      save(next);
      toast(`✅ Foco completo (${FOCUS_MIN}min). Pausa de ${BREAK_MIN}min.`, 'success');
    } else {
      // Pausa termina — encerra ciclo
      setPersisted(null);
      save(null);
      toast('⏰ Pausa terminou. Pronto pra próximo ciclo?', 'success');
    }
  }, [now, persisted]);

  const startFocus = () => {
    const p: Persisted = {
      phase: 'focus',
      endsAt: Date.now() + FOCUS_MIN * 60_000,
      paused: false,
    };
    setPersisted(p);
    save(p);
    setExpanded(true);
  };

  const togglePause = () => {
    if (!persisted) return;
    if (persisted.paused) {
      // Retoma usando remainingMs
      const remaining = persisted.remainingMs ?? 0;
      const next: Persisted = {
        phase: persisted.phase,
        endsAt: Date.now() + remaining,
        paused: false,
      };
      setPersisted(next);
      save(next);
    } else {
      const remaining = Math.max(0, persisted.endsAt - Date.now());
      const next: Persisted = {
        ...persisted,
        paused: true,
        remainingMs: remaining,
      };
      setPersisted(next);
      save(next);
    }
  };

  const stop = () => {
    setPersisted(null);
    save(null);
  };

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
        style={{
          position: 'fixed',
          left: 16,
          bottom: 16,
          zIndex: 35,
          background: 'var(--bg-elev)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius)',
          padding: '8px 12px',
          boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
          fontSize: '0.85rem',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <span>🍅 Pomodoro</span>
        <button
          type="button"
          className="primary"
          onClick={startFocus}
          style={{ padding: '3px 10px', fontSize: '0.85rem' }}
        >
          Começar {FOCUS_MIN}min
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
    );
  }

  const remaining = persisted.paused
    ? persisted.remainingMs ?? 0
    : Math.max(0, persisted.endsAt - now);
  const isFocus = persisted.phase === 'focus';

  return (
    <div
      role="status"
      aria-live="off"
      style={{
        position: 'fixed',
        left: 16,
        bottom: 16,
        zIndex: 35,
        background: 'var(--bg-elev)',
        border: `1px solid ${isFocus ? 'var(--primary)' : 'var(--warn, #d97706)'}`,
        borderRadius: 'var(--radius)',
        padding: '10px 14px',
        boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        fontVariantNumeric: 'tabular-nums',
      }}
    >
      <span aria-hidden style={{ fontSize: '1.2rem' }}>
        {isFocus ? '🍅' : '☕'}
      </span>
      <div>
        <div style={{ fontSize: '0.75rem', opacity: 0.75 }}>
          {isFocus ? 'Foco' : 'Pausa'}
          {persisted.paused && ' (pausado)'}
        </div>
        <div style={{ fontSize: '1.1rem', fontWeight: 500 }}>
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
        onClick={stop}
        title="Encerrar"
        aria-label="Encerrar"
      >
        ✕
      </button>
    </div>
  );
}
