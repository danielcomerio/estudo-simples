'use client';

import { setAlgorithm, useAlgorithm } from '@/lib/settings';
import type { SRSAlgorithm } from '@/lib/srs-fsrs';
import { toast } from './Toast';

const OPTIONS: Array<{
  value: SRSAlgorithm;
  label: string;
  desc: string;
}> = [
  {
    value: 'sm2',
    label: 'SM-2 (padrão clássico)',
    desc: 'Algoritmo do Anki até 2023. Estável, comportamento bem conhecido. Boa escolha se você nunca pensou no assunto.',
  },
  {
    value: 'fsrs',
    label: 'FSRS-6 (estado da arte)',
    desc: 'Algoritmo padrão do Anki desde 2023. ~20-30% menos revisões pra mesma retenção, sem "ease hell" do SM-2. Recomendado.',
  },
];

export function AlgorithmSection() {
  const current = useAlgorithm();

  const change = (next: SRSAlgorithm) => {
    if (next === current) return;
    try {
      setAlgorithm(next);
      toast(
        `Algoritmo alterado para ${next.toUpperCase()}. Próximas revisões usarão o novo.`,
        'success'
      );
    } catch (e) {
      toast(
        e instanceof Error ? e.message : 'Falha ao salvar preferência',
        'error'
      );
    }
  };

  return (
    <section className="card">
      <h2>Algoritmo de revisão</h2>
      <p className="muted" style={{ marginTop: -4 }}>
        Decide quando cada questão volta a aparecer. Você pode trocar a
        qualquer momento sem perder histórico — campos do algoritmo
        anterior ficam preservados.
      </p>

      <div
        role="radiogroup"
        aria-label="Algoritmo de revisão"
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          marginTop: 12,
        }}
      >
        {OPTIONS.map((opt) => {
          const isCurrent = opt.value === current;
          return (
            <label
              key={opt.value}
              className="check-row"
              style={{
                background: isCurrent
                  ? 'var(--primary-soft)'
                  : 'var(--bg-elev-2)',
                border: isCurrent
                  ? '1px solid var(--primary)'
                  : '1px solid var(--border)',
                borderRadius: 'var(--radius)',
                padding: '12px 14px',
                cursor: 'pointer',
                alignItems: 'flex-start',
              }}
            >
              <input
                type="radio"
                name="srs-algorithm"
                value={opt.value}
                checked={isCurrent}
                onChange={() => change(opt.value)}
                style={{ marginTop: 4, flexShrink: 0 }}
              />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 600 }}>{opt.label}</div>
                <div
                  className="muted"
                  style={{ fontSize: '0.88rem', marginTop: 2 }}
                >
                  {opt.desc}
                </div>
              </div>
            </label>
          );
        })}
      </div>

      <p
        className="muted"
        style={{
          marginTop: 12,
          fontSize: '0.85rem',
          fontStyle: 'italic',
        }}
      >
        Preferência salva localmente neste navegador. Será movida pra
        conta (sincronizada entre dispositivos) numa etapa futura.
      </p>
    </section>
  );
}
