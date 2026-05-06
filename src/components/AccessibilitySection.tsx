'use client';

import {
  setCvdMode,
  useCvdMode,
  type CvdMode,
  setFontSize,
  useFontSize,
  type FontSize,
} from '@/lib/settings';

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
const FONT_OPTIONS: { value: FontSize; label: string; sub: string }[] = [
  { value: 'normal', label: 'Normal', sub: '16px (default)' },
  { value: 'large', label: 'Grande', sub: '18px (+12%)' },
  { value: 'xlarge', label: 'Extra grande', sub: '20px (+25%)' },
];

export function AccessibilitySection() {
  const mode = useCvdMode();
  const font = useFontSize();

  return (
    <div className="card">
      <h2 style={{ margin: '0 0 6px' }}>♿ Acessibilidade</h2>

      <h3 style={{ margin: '14px 0 6px', fontSize: '1rem' }}>
        Tamanho de fonte
      </h3>
      <p
        className="muted"
        style={{ margin: '0 0 10px', fontSize: '0.88rem' }}
      >
        Aumenta o tamanho do texto em todo o app.
      </p>
      <div
        className="row gap"
        style={{ flexWrap: 'wrap', marginBottom: 16 }}
      >
        {FONT_OPTIONS.map((opt) => {
          const active = font === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              className={active ? 'primary' : 'ghost'}
              onClick={() => setFontSize(opt.value)}
              title={opt.sub}
              style={{ padding: '8px 14px' }}
            >
              {opt.label} <span style={{ opacity: 0.6, fontSize: '0.78em' }}>· {opt.sub}</span>
            </button>
          );
        })}
      </div>

      <h3 style={{ margin: '14px 0 6px', fontSize: '1rem' }}>
        Paleta para daltonismo (CVD)
      </h3>
      <p
        className="muted"
        style={{ margin: '0 0 12px', fontSize: '0.88rem', lineHeight: 1.5 }}
      >
        Substitui paleta verde/vermelho. ~8% dos homens e 0.5% das
        mulheres têm alguma forma de CVD. Aplicado instantâneo.
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
