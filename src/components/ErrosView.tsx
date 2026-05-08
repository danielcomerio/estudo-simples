'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { selectActiveQuestions, useStore } from '@/lib/store';
import { renderRichText } from '@/lib/utils';

type Errada = {
  id: string;
  enunciado: string;
  disciplina: string;
  attempts: number;
  acerto: number; // 0-1
  alternativaMaisErrada: string | null;
};

export function ErrosView() {
  const questions = useStore(selectActiveQuestions);
  const [scope, setScope] = useState<'todas' | 'objetivas'>('todas');

  const inimigas: Errada[] = useMemo(() => {
    const out: Errada[] = [];
    for (const q of questions) {
      const t = q.stats?.attempts ?? 0;
      const c = q.stats?.correct ?? 0;
      if (t < 3) continue;
      const acerto = c / t;
      if (acerto >= 0.4) continue;
      if (scope === 'objetivas' && q.type !== 'objetiva') continue;
      const enun =
        (q.payload as { enunciado?: string; frente?: string; texto?: string })
          .enunciado ??
        (q.payload as { frente?: string }).frente ??
        (q.payload as { texto?: string }).texto ??
        '';
      // Alt mais errada
      let alternativaMaisErrada: string | null = null;
      const hist = q.stats?.history ?? [];
      const errorAlts: Record<string, number> = {};
      for (const h of hist) {
        if (h.result !== 'wrong') continue;
        if (typeof h.answer === 'string' && h.answer) {
          errorAlts[h.answer] = (errorAlts[h.answer] ?? 0) + 1;
        }
      }
      const top = Object.entries(errorAlts).sort((a, b) => b[1] - a[1])[0];
      if (top) alternativaMaisErrada = top[0];
      out.push({
        id: q.id,
        enunciado: enun,
        disciplina: q.disciplina_id ?? '—',
        attempts: t,
        acerto,
        alternativaMaisErrada,
      });
    }
    return out.sort((a, b) => a.acerto - b.acerto);
  }, [questions, scope]);

  // Agrega por disciplina
  const byDisc = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of inimigas) m.set(e.disciplina, (m.get(e.disciplina) ?? 0) + 1);
    return Array.from(m.entries()).sort((a, b) => b[1] - a[1]);
  }, [inimigas]);

  return (
    <>
      <div className="card">
        <h1 style={{ margin: '0 0 4px' }}>👹 Inimigas</h1>
        <p className="muted" style={{ margin: 0, fontSize: '0.9rem' }}>
          Questões com ≥3 tentativas e &lt;40% acerto — onde você mais erra.
          Bom alvo pra revisão focada.
        </p>
      </div>

      <div className="card">
        <div className="row gap" style={{ alignItems: 'center', marginBottom: 12 }}>
          <label>
            <input
              type="radio"
              name="scope"
              checked={scope === 'todas'}
              onChange={() => setScope('todas')}
            />{' '}
            Todas
          </label>
          <label>
            <input
              type="radio"
              name="scope"
              checked={scope === 'objetivas'}
              onChange={() => setScope('objetivas')}
            />{' '}
            Só objetivas
          </label>
          <span style={{ flex: 1 }} />
          <Link
            href={`/estudar?modo=inimigas&qtd=${Math.min(20, inimigas.length || 1)}&auto=1`}
            className="primary"
            style={{ padding: '6px 12px', borderRadius: 'var(--radius)', textDecoration: 'none' }}
          >
            ▶ Estudar inimigas
          </Link>
        </div>

        <p style={{ fontSize: '0.92rem', marginBottom: 12 }}>
          <strong>{inimigas.length}</strong> questão(ões) inimigas
        </p>

        {byDisc.length > 0 && (
          <div className="muted" style={{ fontSize: '0.85rem', marginBottom: 12 }}>
            Por disciplina:{' '}
            {byDisc.slice(0, 5).map(([d, n], i) => (
              <span key={d}>
                {i > 0 && ' · '}
                <strong>{d}</strong> ({n})
              </span>
            ))}
          </div>
        )}

        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {inimigas.slice(0, 50).map((e) => (
            <li
              key={e.id}
              style={{
                padding: '10px 12px',
                marginBottom: 8,
                background: 'var(--bg-elev-2)',
                borderLeft: '3px solid var(--danger)',
                borderRadius: 'var(--radius)',
              }}
            >
              <div className="row gap" style={{ fontSize: '0.82rem', marginBottom: 4 }}>
                <span className="muted">{e.disciplina}</span>
                <span style={{ color: 'var(--danger)' }}>
                  {Math.round(e.acerto * 100)}% em {e.attempts} tentativas
                </span>
                {e.alternativaMaisErrada && (
                  <span className="muted">
                    · cai mais em: <strong>{e.alternativaMaisErrada}</strong>
                  </span>
                )}
              </div>
              <div
                style={{ fontSize: '0.9rem' }}
                dangerouslySetInnerHTML={{
                  __html: renderRichText(e.enunciado.slice(0, 280)) + (e.enunciado.length > 280 ? '…' : ''),
                }}
              />
            </li>
          ))}
        </ul>
        {inimigas.length > 50 && (
          <p className="muted" style={{ fontSize: '0.82rem', textAlign: 'center' }}>
            +{inimigas.length - 50} adicionais — limite 50 mostradas.
          </p>
        )}
      </div>
    </>
  );
}
