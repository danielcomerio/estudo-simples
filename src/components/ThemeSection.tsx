'use client';

import { setTheme, useTheme, type Theme } from '@/lib/settings';

const OPTIONS: Array<{ value: Theme; label: string; desc: string }> = [
  {
    value: 'auto',
    label: '🖥 Automático',
    desc: 'Segue a preferência do sistema operacional (recomendado).',
  },
  {
    value: 'dark',
    label: '🌙 Escuro',
    desc: 'Forçar tema escuro independente do sistema.',
  },
  {
    value: 'light',
    label: '☀️ Claro',
    desc: 'Forçar tema claro independente do sistema.',
  },
  {
    value: 'amoled',
    label: '⚫ AMOLED',
    desc: 'Preto puro — economiza bateria em telas OLED (celular).',
  },
];

export function ThemeSection() {
  const current = useTheme();
  return (
    <section className="card">
      <h2>Tema visual</h2>
      <p className="muted" style={{ marginTop: -4 }}>
        Cores da interface. Auto segue o sistema; light/dark fixa.
      </p>
      <div
        role="radiogroup"
        aria-label="Tema"
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
                name="theme"
                value={opt.value}
                checked={isCurrent}
                onChange={() => setTheme(opt.value)}
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
    </section>
  );
}
