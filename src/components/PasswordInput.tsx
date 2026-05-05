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
    <div style={{ position: 'relative' }}>
      <input
        type={show ? 'text' : 'password'}
        name={name}
        autoComplete={autoComplete}
        minLength={minLength}
        required
        style={{ paddingRight: 38, width: '100%' }}
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
          width: 30,
          height: 30,
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          fontSize: '1rem',
        }}
      >
        {show ? '🙈' : '👁'}
      </button>
    </div>
  );
}
