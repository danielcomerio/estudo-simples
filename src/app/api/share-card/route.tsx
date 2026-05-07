/**
 * GET /api/share-card?streak=N&total=N&acerto=N&dominadas=N
 *   → PNG 1200x630 com card de progresso (formato Open Graph).
 *
 * Stateless — todos números via query string. User clica
 * "Compartilhar progresso" no Dashboard, JS monta a URL com seus
 * stats atuais e copia/abre.
 */

import { ImageResponse } from 'next/og';

export const runtime = 'edge';

function safeInt(v: string | null, dflt = 0): number {
  if (!v) return dflt;
  const n = parseInt(v, 10);
  return Number.isFinite(n) && n >= 0 ? n : dflt;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const streak = safeInt(url.searchParams.get('streak'));
  const total = safeInt(url.searchParams.get('total'));
  const acerto = Math.min(100, safeInt(url.searchParams.get('acerto')));
  const dominadas = safeInt(url.searchParams.get('dominadas'));

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          background:
            'linear-gradient(135deg, #052e16 0%, #14532d 50%, #16a34a 100%)',
          color: '#fff',
          fontFamily: 'system-ui, sans-serif',
          padding: 60,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            marginBottom: 30,
          }}
        >
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 14,
              background: '#22c55e',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 28,
              fontWeight: 700,
            }}
          >
            ES
          </div>
          <div style={{ fontSize: 26, fontWeight: 600, opacity: 0.9 }}>
            Estudo Simples
          </div>
        </div>

        <div style={{ fontSize: 56, fontWeight: 700, marginBottom: 18 }}>
          📊 Meu progresso
        </div>

        <div style={{ display: 'flex', gap: 24, marginBottom: 32 }}>
          <Stat emoji="🔥" label="Streak" value={`${streak}`} unit="dias" />
          <Stat
            emoji="🎯"
            label="Total"
            value={total.toLocaleString('pt-BR')}
            unit="revisões"
          />
          <Stat emoji="💎" label="Acerto" value={`${acerto}`} unit="%" />
          <Stat emoji="🏆" label="Dominadas" value={`${dominadas}`} unit="" />
        </div>

        <div
          style={{
            marginTop: 'auto',
            fontSize: 22,
            opacity: 0.9,
            display: 'flex',
            justifyContent: 'space-between',
          }}
        >
          <div>📚 Repetição espaçada para concursos</div>
          <div>app.estudosimples.com.br</div>
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  );
}

function Stat({
  emoji,
  label,
  value,
  unit,
}: {
  emoji: string;
  label: string;
  value: string;
  unit: string;
}) {
  return (
    <div
      style={{
        flex: 1,
        background: 'rgba(255,255,255,0.1)',
        borderRadius: 16,
        padding: 20,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
      }}
    >
      <div style={{ fontSize: 38, marginBottom: 4 }}>{emoji}</div>
      <div style={{ fontSize: 44, fontWeight: 700, lineHeight: 1 }}>
        {value}
      </div>
      <div style={{ fontSize: 18, opacity: 0.8, marginTop: 4 }}>
        {label} {unit && `(${unit})`}
      </div>
    </div>
  );
}
