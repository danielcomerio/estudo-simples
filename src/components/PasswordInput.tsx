'use client';

import { useState } from 'react';

/**
 * Password input com botão olho (SVG) pra mostrar/esconder.
 * Usa SVG em vez de emoji pra evitar renderização inconsistente entre
 * sistemas (Windows mostrava `👁‍🗨` como dois caracteres).
 */
export function PasswordInput({
  name,
  autoComplete,
  minLength,
}: {
  name: string;
  autoComplete: string;
  minLength?: number;
}) {
  const [show, setShow] = useState(false);
  return (
    <div
      style={{
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        width: '100%',
      }}
    >
      <input
        type={show ? 'text' : 'password'}
        name={name}
        autoComplete={autoComplete}
        minLength={minLength}
        required
        style={{
          paddingRight: 44,
          width: '100%',
          boxSizing: 'border-box',
        }}
      />
      <button
        type="button"
        onClick={() => setShow((v) => !v)}
        title={show ? 'Esconder senha' : 'Mostrar senha'}
        aria-label={show ? 'Esconder senha' : 'Mostrar senha'}
        style={{
          position: 'absolute',
          right: 4,
          top: '50%',
          transform: 'translateY(-50%)',
          width: 34,
          height: 34,
          minWidth: 34,
          minHeight: 34,
          padding: 0,
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--muted)',
          borderRadius: 6,
          transition: 'color 0.15s, background 0.15s',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.color = 'var(--text)';
          e.currentTarget.style.background = 'var(--bg-elev-2, rgba(0,0,0,0.05))';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.color = 'var(--muted)';
          e.currentTarget.style.background = 'transparent';
        }}
      >
        {show ? <EyeIcon /> : <EyeOffIcon />}
      </button>
    </div>
  );
}

function EyeIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 19c-6.5 0-10-7-10-7a17.6 17.6 0 0 1 4.06-4.94" />
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c6.5 0 10 7 10 7a17.62 17.62 0 0 1-2.16 3.19" />
      <path d="M14.12 14.12A3 3 0 1 1 9.88 9.88" />
      <line x1="2" y1="2" x2="22" y2="22" />
    </svg>
  );
}
