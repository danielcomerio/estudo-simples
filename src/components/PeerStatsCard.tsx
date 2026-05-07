'use client';

import { useEffect, useState } from 'react';

type PeerStats = {
  total_attempts: number;
  active_users: number;
  p25: number | null;
  p50: number | null;
  p75: number | null;
  user_avg: number | null;
};

export function PeerStatsCard() {
  const [data, setData] = useState<PeerStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/peers/stats')
      .then((r) => r.json())
      .then((j) => {
        if (j.error) setError(j.error);
        else setData(j);
      })
      .catch((e) => setError(String(e)));
  }, []);

  if (error) {
    return (
      <div className="card">
        <h2 style={{ margin: '0 0 8px' }}>👥 Comparativo com a comunidade</h2>
        <p className="muted">Sem dados disponíveis no momento.</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="card">
        <h2 style={{ margin: '0 0 8px' }}>👥 Comparativo com a comunidade</h2>
        <p className="muted">Carregando…</p>
      </div>
    );
  }

  if (data.total_attempts === 0) {
    return (
      <div className="card">
        <h2 style={{ margin: '0 0 8px' }}>👥 Comparativo com a comunidade</h2>
        <p className="muted">
          Ainda sem dados suficientes da comunidade. Volte em breve.
        </p>
      </div>
    );
  }

  const userAvg = data.user_avg;
  const userPos = userAvg === null ? null : positionLabel(userAvg, data);

  return (
    <div className="card">
      <h2 style={{ margin: '0 0 8px' }}>
        👥 Comparativo com a comunidade
      </h2>
      <p className="muted" style={{ margin: '0 0 14px', fontSize: '0.88rem' }}>
        % acerto no desafio diário (90 dias). Anônimo.
      </p>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))',
          gap: 10,
          marginBottom: 14,
        }}
      >
        <Cell label="P25" value={`${data.p25 ?? 0}%`} />
        <Cell
          label="Mediana"
          value={`${data.p50 ?? 0}%`}
          highlight
        />
        <Cell label="P75" value={`${data.p75 ?? 0}%`} />
      </div>

      {userAvg !== null ? (
        <div
          style={{
            padding: 12,
            borderRadius: 'var(--radius)',
            background: 'var(--primary-soft)',
            border: '1px solid var(--primary)',
          }}
        >
          <strong>Você: {userAvg}% de acerto.</strong>{' '}
          {userPos && <span>{userPos}</span>}
        </div>
      ) : (
        <p className="muted" style={{ margin: 0, fontSize: '0.88rem' }}>
          Faça o <strong>Desafio Diário</strong> em /diario pra entrar na
          comparação.
        </p>
      )}

      <p className="muted" style={{ margin: '12px 0 0', fontSize: '0.78rem' }}>
        Baseado em {data.total_attempts.toLocaleString('pt-BR')} attempts de{' '}
        {data.active_users} estudantes ativos.
      </p>
    </div>
  );
}

function Cell({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div
      style={{
        padding: 10,
        textAlign: 'center',
        borderRadius: 'var(--radius)',
        background: highlight ? 'var(--bg-elev-2)' : 'transparent',
        border: '1px solid var(--border)',
      }}
    >
      <div className="muted" style={{ fontSize: '0.75rem' }}>
        {label}
      </div>
      <div style={{ fontSize: '1.4rem', fontWeight: 700 }}>{value}</div>
    </div>
  );
}

function positionLabel(avg: number, p: PeerStats): string {
  if (p.p75 !== null && avg >= p.p75) return '🥇 No top 25%!';
  if (p.p50 !== null && avg >= p.p50) return '✅ Acima da mediana.';
  if (p.p25 !== null && avg >= p.p25) return 'Em desenvolvimento.';
  return 'Foco no estudo — você vai chegar lá.';
}
