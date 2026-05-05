import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const alt = 'Planos — Estudo Simples';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

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
        <div style={{ fontSize: 24, color: '#9ca3af', marginBottom: 'auto' }}>
          Estudo Simples
        </div>

        <div style={{ display: 'flex', gap: 40 }}>
          {/* Free */}
          <div
            style={{
              flex: 1,
              border: '1px solid #374151',
              borderRadius: 16,
              padding: 36,
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
            }}
          >
            <div style={{ fontSize: 18, color: '#9ca3af' }}>GRÁTIS</div>
            <div style={{ fontSize: 56, fontWeight: 700 }}>R$ 0</div>
            <div style={{ fontSize: 18, color: '#9ca3af' }}>até 500 questões</div>
          </div>
          {/* Pro */}
          <div
            style={{
              flex: 1,
              border: '2px solid #22c55e',
              background: 'rgba(34,197,94,0.08)',
              borderRadius: 16,
              padding: 36,
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
            }}
          >
            <div style={{ fontSize: 18, color: '#22c55e' }}>PRO</div>
            <div style={{ fontSize: 56, fontWeight: 700, color: '#22c55e' }}>
              R$ 19,90<span style={{ fontSize: 24, color: '#9ca3af' }}>/mês</span>
            </div>
            <div style={{ fontSize: 18, color: '#d1fae5' }}>tudo ilimitado</div>
          </div>
        </div>

        <div
          style={{
            fontSize: 26,
            color: '#9ca3af',
            marginTop: 40,
            textAlign: 'center',
            width: '100%',
          }}
        >
          Cancele a qualquer momento.
        </div>
      </div>
    ),
    { ...size }
  );
}
