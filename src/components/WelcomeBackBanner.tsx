'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

const KEY = 'estudo-simples:lastVisit';

/**
 * Banner gentil quando user volta após >= 3 dias sem login. Marca
 * timestamp da visita atual no LS — comparação na próxima.
 *
 * Mostrado só uma vez (1 sessão de browser). Dispense fecha pra sempre
 * pra essa "volta".
 */
export function WelcomeBackBanner({ dueCount }: { dueCount: number }) {
  const [show, setShow] = useState(false);
  const [daysAway, setDaysAway] = useState(0);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const lastRaw = localStorage.getItem(KEY);
      const now = Date.now();
      // Marca timestamp atual sempre
      localStorage.setItem(KEY, String(now));
      // Se nunca visitou antes, não mostra (é primeira vez)
      if (!lastRaw) return;
      const last = parseInt(lastRaw, 10);
      if (Number.isNaN(last)) return;
      const days = Math.floor((now - last) / (24 * 60 * 60 * 1000));
      if (days >= 3) {
        setDaysAway(days);
        setShow(true);
      }
    } catch {}
  }, []);

  if (!show) return null;

  return (
    <div
      className="card"
      style={{
        background: 'linear-gradient(135deg, rgba(34,197,94,0.12), rgba(34,197,94,0.04))',
        border: '1px solid var(--primary)',
        padding: 14,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        flexWrap: 'wrap',
      }}
      role="status"
    >
      <span style={{ fontSize: '1.6rem' }} aria-hidden>
        👋
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <strong style={{ fontSize: '1rem' }}>Bem-vindo de volta!</strong>
        <div
          style={{
            fontSize: '0.88rem',
            color: 'var(--muted)',
            marginTop: 2,
          }}
        >
          Você sumiu por {daysAway} dia{daysAway === 1 ? '' : 's'}.
          {dueCount > 0 ? (
            <>
              {' '}
              Tem <strong>{dueCount}</strong> questão{dueCount === 1 ? '' : 'ões'} vencendo.
              Que tal começar suave?
            </>
          ) : (
            <> Tudo em dia. Bom retorno!</>
          )}
        </div>
      </div>
      {dueCount > 0 && (
        <Link href="/estudar?modo=srs&qtd=10&auto=1">
          <button type="button" className="primary" style={{ whiteSpace: 'nowrap' }}>
            ▶ 10 questões
          </button>
        </Link>
      )}
      <button
        type="button"
        className="ghost"
        onClick={() => setShow(false)}
        aria-label="Fechar"
        title="Fechar"
        style={{ padding: '4px 10px' }}
      >
        ✕
      </button>
    </div>
  );
}
