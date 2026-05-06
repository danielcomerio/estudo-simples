'use client';

import { setCvdMode, useCvdMode, type CvdMode } from '@/lib/settings';

const OPTIONS: { value: CvdMode; label: string; sub: string }[] = [
  {
    value: 'off',
    label: 'Padrão',
    sub: 'verde / vermelho — paleta normal',
  },
  {
    value: 'deutan',
    label: 'Deuteranopia',
    sub: 'azul / laranja — verde indistinguível (~6% dos homens)',
  },
  {
    value: 'protan',
    label: 'Protanopia',
    sub: 'azul / laranja — vermelho indistinguível (~1% dos homens)',
  },
  {
    value: 'tritan',
    label: 'Tritanopia',
    sub: 'verde / magenta — azul indistinguível (raro)',
  },
];

/**
 * Toggle de modo CVD (Color Vision Deficiency). Substitui paleta de
 * cores quando ativo. Mudança aplicada em real-time via setCvdMode.
 */
export function AccessibilitySection() {
  const mode = useCvdMode();

  return (
    <div className="card">
      <h2 style={{ margin: '0 0 6px' }}>♿ Acessibilidade</h2>
      <p
        className="muted"
        style={{ margin: '0 0 12px', fontSize: '0.9rem', lineHeight: 1.5 }}
      >
        Paleta alternativa para daltonismo (CVD). Aproximadamente 8% dos
        homens e 0.5% das mulheres têm alguma forma de CVD. Aplicado
        instantâneo a todo o app.
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {OPTIONS.map((opt) => (
          <label
            key={opt.value}
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 10,
              padding: 10,
              border: `1px solid ${mode === opt.value ? 'var(--primary)' : 'var(--border)'}`,
              borderRadius: 'var(--radius)',
              background: mode === opt.value ? 'var(--primary-soft)' : 'transparent',
              cursor: 'pointer',
            }}
          >
            <input
              type="radio"
              name="cvd-mode"
              checked={mode === opt.value}
              onChange={() => setCvdMode(opt.value)}
              style={{ marginTop: 3 }}
            />
            <div>
              <div style={{ fontWeight: 500 }}>{opt.label}</div>
              <div className="muted" style={{ fontSize: '0.82rem' }}>
                {opt.sub}
              </div>
            </div>
          </label>
        ))}
      </div>
    </div>
  );
}
