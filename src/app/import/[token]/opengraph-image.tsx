/**
 * OG image dinâmica pra link de import compartilhado.
 *
 * Renderiza um card com:
 *  - Logo + branding
 *  - "Você foi convidado a importar X questões"
 *  - Owner mascarado
 *
 * Sem chamada DB pra evitar timeout em build — tudo derivado do path.
 * Pra mostrar count real, precisaria query no servidor (custo). Versão
 * estática primeiro, dinâmica depois se houver demanda.
 */

import { ImageResponse } from 'next/og';

export const alt = 'Convite pra importar questões — Estudo Simples';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export const runtime = 'edge';

export default function OGImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          background:
            'linear-gradient(135deg, #0b1220 0%, #1e293b 50%, #052e16 100%)',
          color: '#fff',
          fontFamily: 'system-ui, sans-serif',
          padding: 80,
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: 16,
              background: 'linear-gradient(135deg, #22c55e, #16a34a)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 32,
              fontWeight: 700,
            }}
          >
            ES
          </div>
          <div style={{ fontSize: 28, fontWeight: 600 }}>Estudo Simples</div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ fontSize: 64, fontWeight: 700, lineHeight: 1.1 }}>
            🎁 Você foi convidado!
          </div>
          <div style={{ fontSize: 32, color: '#86efac' }}>
            Importe um deck de questões compartilhado
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            color: '#94a3b8',
            fontSize: 22,
          }}
        >
          <div>📚 Repetição espaçada para concursos</div>
          <div>app.estudosimples.com.br</div>
        </div>
      </div>
    ),
    size
  );
}
