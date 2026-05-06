'use client';

import { useState } from 'react';

/**
 * Password input com botão olho pra mostrar/esconder. Reduz typo
 * e ajuda quem usa autofill.
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
          right: 6,
          top: '50%',
          transform: 'translateY(-50%)',
          width: 32,
          height: 32,
          minWidth: 32,
          minHeight: 32,
          padding: 0,
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          fontSize: '1.05rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--muted)',
        }}
      >
        {/* Ícone reflete o ESTADO atual: olho = visível, olho-corte = escondido */}
        {show ? '👁' : '👁‍🗨'}
      </button>
    </div>
  );
}
