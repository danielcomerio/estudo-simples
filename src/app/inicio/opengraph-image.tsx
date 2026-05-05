import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const alt = 'Estudo Simples — repetição espaçada para concursos';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

/**
 * OG image dinâmica. Renderiza via Edge runtime do Next 14 com
 * ImageResponse — sem PNG estático em disco. Fonte system, sem deps
 * extras de fonte (mantém bundle leve).
 */
export default async function OG() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          background: 'linear-gradient(135deg, #0b1220 0%, #1f2937 100%)',
          color: '#e5e7eb',
          padding: '64px 72px',
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        {/* Logo / brand */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            marginBottom: 'auto',
          }}
        >
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: 24,
              background: 'linear-gradient(135deg, #22c55e, #16a34a)',
              boxShadow: '0 0 0 6px rgba(34,197,94,0.18)',
            }}
          />
          <div style={{ fontSize: 28, fontWeight: 600, letterSpacing: '-0.01em' }}>
            Estudo Simples
          </div>
        </div>

        {/* Headline */}
        <div style={{ display: 'flex', flexDirection: 'column', marginBottom: 30 }}>
          <div
            style={{
              fontSize: 72,
              fontWeight: 700,
              lineHeight: 1.05,
              letterSpacing: '-0.02em',
              marginBottom: 18,
            }}
          >
            Estude com inteligência.
          </div>
          <div
            style={{
              fontSize: 72,
              fontWeight: 700,
              lineHeight: 1.05,
              letterSpacing: '-0.02em',
              color: '#22c55e',
            }}
          >
            Aprove no concurso.
          </div>
        </div>

        {/* Subline */}
        <div
          style={{
            fontSize: 28,
            color: '#9ca3af',
            lineHeight: 1.4,
            maxWidth: 880,
          }}
        >
          Repetição espaçada (SM-2 e FSRS), simulados, calibração metacognitiva.
        </div>
      </div>
    ),
    { ...size }
  );
}
