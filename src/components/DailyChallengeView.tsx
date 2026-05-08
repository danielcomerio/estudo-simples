'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

/**
 * /diario — Questões do Dia (modo comunidade).
 *
 * MVP: mostra info do set do dia + status (já fez? botão pra começar).
 * Quando concluído, mostra ranking top 50.
 *
 * Próxima iteração: runner inline pra responder no próprio /diario
 * (sem ir pra /estudar) + mecânica gamificada (streak diário, badges).
 */
type SetData = {
  available: boolean;
  set?: {
    id: string;
    date: string;
    title: string | null;
    description: string | null;
    questions: Array<{ id: string; type: string; disciplina_id: string | null }>;
  };
  attempt?: {
    score_pct: number;
    correct_count: number;
    total_questions: number;
    completed_at: string;
    duration_s: number;
  } | null;
};

type RankingEntry = {
  rank: number;
  display: string;
  score_pct: number;
  correct: number;
  total: number;
  duration_s: number;
  is_you: boolean;
};

export function DailyChallengeView() {
  const [data, setData] = useState<SetData | null>(null);
  const [loading, setLoading] = useState(true);
  const [ranking, setRanking] = useState<RankingEntry[] | null>(null);

  const reload = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/daily/set');
      const json = await res.json();
      setData(json as SetData);
      if ((json as SetData).set?.id) {
        const r = await fetch(
          `/api/daily/ranking?set_id=${(json as SetData).set!.id}`
        );
        const rj = await r.json();
        setRanking((rj.ranking as RankingEntry[]) ?? []);
      }
    } catch {}
    setLoading(false);
  };

  useEffect(() => {
    void reload();
  }, []);

  if (loading) {
    return (
      <main className="page" style={{ maxWidth: 720 }}>
        <h1>📅 Questões do Dia</h1>
        <p className="muted">Carregando…</p>
      </main>
    );
  }

  if (!data?.available) {
    return (
      <main className="page" style={{ maxWidth: 720 }}>
        <h1>📅 Questões do Dia</h1>
        <div className="card">
          <p>Hoje ainda não foi publicado um set comunitário.</p>
          <p className="muted" style={{ fontSize: '0.85rem' }}>
            Sets são curados pela plataforma e ficam disponíveis a partir
            das 5h da manhã (UTC). Volte mais tarde ou estude do banco
            normal em /estudar.
          </p>
          <Link href="/estudar">
            <button type="button" className="primary">
              Estudar agora →
            </button>
          </Link>
        </div>
      </main>
    );
  }

  const set = data.set!;
  const attempt = data.attempt;

  return (
    <main className="page" style={{ maxWidth: 720 }}>
      <h1>📅 Questões do Dia · {set.date}</h1>

      <div className="card" style={{ marginTop: 14 }}>
        {set.title && (
          <h2 style={{ margin: '0 0 6px', fontSize: '1.1rem' }}>
            {set.title}
          </h2>
        )}
        {set.description && (
          <p className="muted" style={{ margin: 0, fontSize: '0.9rem' }}>
            {set.description}
          </p>
        )}
        <div
          className="muted"
          style={{ marginTop: 8, fontSize: '0.85rem' }}
        >
          📊 {set.questions.length} questões mistas · todos os
          participantes recebem o mesmo set.
        </div>

        {!attempt && (
          <div style={{ marginTop: 14 }}>
            <Link
              href={`/estudar?daily=${set.id}&auto=1`}
              prefetch={false}
            >
              <button
                type="button"
                className="primary"
                style={{ padding: '12px 20px' }}
              >
                ▶ Começar desafio
              </button>
            </Link>
          </div>
        )}

        {attempt && (
          <div
            style={{
              marginTop: 14,
              padding: 12,
              background: 'var(--primary-soft)',
              borderRadius: 'var(--radius)',
              borderLeft: '3px solid var(--primary)',
            }}
          >
            ✅ Concluído!{' '}
            <strong>
              {attempt.correct_count}/{attempt.total_questions}
            </strong>{' '}
            ({attempt.score_pct}%) em{' '}
            {Math.floor(attempt.duration_s / 60)}min{' '}
            {attempt.duration_s % 60}s.
            <ShareDailyResult
              correct={attempt.correct_count}
              total={attempt.total_questions}
              pct={attempt.score_pct}
            />
          </div>
        )}
      </div>

      {ranking && ranking.length > 0 && (
        <div className="card" style={{ marginTop: 14 }}>
          <h2 style={{ margin: '0 0 10px', fontSize: '1.05rem' }}>
            🏆 Ranking (top {ranking.length})
          </h2>
          <ol
            style={{
              listStyle: 'none',
              padding: 0,
              margin: 0,
              fontSize: '0.9rem',
            }}
          >
            {ranking.map((r) => (
              <li
                key={r.rank}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  padding: '6px 8px',
                  borderRadius: 4,
                  background: r.is_you
                    ? 'var(--primary-soft)'
                    : r.rank <= 3
                      ? 'var(--bg-elev-2)'
                      : 'transparent',
                  fontWeight: r.is_you ? 600 : undefined,
                }}
              >
                <span>
                  {r.rank === 1
                    ? '🥇'
                    : r.rank === 2
                      ? '🥈'
                      : r.rank === 3
                        ? '🥉'
                        : `${r.rank}º`}{' '}
                  <code style={{ fontSize: '0.85rem' }}>{r.display}</code>
                  {r.is_you && (
                    <span
                      style={{
                        marginLeft: 6,
                        fontSize: '0.75rem',
                        color: 'var(--primary)',
                      }}
                    >
                      (você)
                    </span>
                  )}
                </span>
                <span className="muted">
                  {r.score_pct}% · {Math.floor(r.duration_s / 60)}m
                  {r.duration_s % 60}s
                </span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </main>
  );
}


function ShareDailyResult({ correct, total, pct }: { correct: number; total: number; pct: number }) {
  const date = new Date().toISOString().slice(0, 10);
  const grid = "🟩".repeat(correct) + "⬜".repeat(Math.max(0, total - correct));
  const text = `📚 Estudo Simples · ${date}
${grid}
${pct}% (${correct}/${total})
estudosimples.com.br/diario`;
  return (
    <div style={{ marginTop: 10 }}>
      <button
        type="button"
        className="ghost"
        onClick={async () => {
          try {
            if (navigator.clipboard) {
              await navigator.clipboard.writeText(text);
              alert("Copiado! Cole no WhatsApp/X/Discord.");
            }
          } catch {
            /* ignore */
          }
        }}
        style={{ padding: "4px 10px", fontSize: "0.82rem" }}
      >
        📋 Copiar resultado pra compartilhar
      </button>
      <pre
        style={{
          marginTop: 6,
          fontSize: "0.85rem",
          background: "var(--bg-elev-2)",
          padding: 8,
          borderRadius: "var(--radius)",
          whiteSpace: "pre-wrap",
          fontFamily: "inherit",
        }}
      >
        {text}
      </pre>
    </div>
  );
}
