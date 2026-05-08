'use client';

import { useEffect, useState } from 'react';
import { readFreezes, maybeEarnFromStreak } from '@/lib/streak-freezes';

/**
 * Card no Painel mostrando freezes ganhos. Aparece SÓ quando user
 * tem >= 1 freeze ou quando está perto de ganhar (streak >= 5 e <7).
 */
export function StreakFreezesCard({ currentStreak }: { currentStreak: number }) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    // Tenta reivindicar milestone do streak atual
    maybeEarnFromStreak(currentStreak);
    setCount(readFreezes().count);
  }, [currentStreak]);

  // Esconde quando não há freeze E streak < 5 (longe do milestone)
  if (count === 0 && currentStreak < 5) return null;

  const proximoMilestone = (Math.floor(currentStreak / 7) + 1) * 7;
  const diasFalt = proximoMilestone - currentStreak;

  return (
    <div
      className="card"
      style={{
        padding: 12,
        display: 'flex',
        gap: 10,
        alignItems: 'center',
        fontSize: '0.92rem',
      }}
    >
      <span aria-hidden style={{ fontSize: '1.6rem' }}>
        🧊
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <strong>
          {count} gelo{count !== 1 ? 's' : ''} de streak
        </strong>
        <div className="muted" style={{ fontSize: '0.82rem', marginTop: 2 }}>
          {count > 0
            ? 'Protegem o streak num dia vazio. 1 consumido por dia perdido.'
            : `Mais ${diasFalt} dia${diasFalt > 1 ? 's' : ''} consecutivo${diasFalt > 1 ? 's' : ''} pra ganhar 1 gelo.`}
        </div>
      </div>
    </div>
  );
}
