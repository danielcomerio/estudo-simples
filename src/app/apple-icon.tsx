import { ImageResponse } from 'next/og';

/**
 * Apple touch icon dinâmico via Next 14 convention. Gera 180×180 PNG.
 * Browsers iOS/Safari preferem PNG sobre SVG pra apple-touch-icon.
 *
 * Mantém visual consistente com o favicon SVG (mesmo background dark
 * + circle verde + checkmark).
 */
export const runtime = 'edge';
export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '180px',
          height: '180px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#0b1220',
          borderRadius: '36px',
        }}
      >
        <div
          style={{
            width: '110px',
            height: '110px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <svg
            width="64"
            height="64"
            viewBox="0 0 64 64"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M 22 33 L 29 40 L 43 26"
              stroke="#062013"
              strokeWidth="5"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
      </div>
    ),
    { ...size }
  );
}
