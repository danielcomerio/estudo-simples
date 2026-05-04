'use client';

import { useFormState, useFormStatus } from 'react-dom';
import Link from 'next/link';
import { enterAsGuest, signup, type AuthState } from '../auth/actions';
import { useIsGuest } from '@/lib/settings';

const initial: AuthState = { error: null, message: null };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="primary" disabled={pending}>
      {pending ? 'Criando…' : 'Criar conta'}
    </button>
  );
}

function GuestSubmit() {
  return (
    <button
      type="submit"
      className="ghost"
      formAction={enterAsGuest}
      formNoValidate
      style={{ width: '100%' }}
    >
      👤 Entrar como visitante
    </button>
  );
}

export default function SignupPage() {
  const [state, formAction] = useFormState(signup, initial);
  const isGuest = useIsGuest();

  return (
    <main className="auth-shell">
      <form action={formAction} className="auth-form">
        <h1>Criar conta</h1>
        <p className="muted">Crie sua instância pessoal de estudo.</p>

        {isGuest && (
          <div
            style={{
              background: 'var(--primary-soft)',
              border: '1px solid var(--primary)',
              borderRadius: 'var(--radius)',
              padding: '10px 12px',
              marginBottom: 4,
              fontSize: '0.9rem',
            }}
          >
            <strong>Migrar dados do visitante</strong>
            <label
              style={{
                display: 'flex',
                gap: 8,
                marginTop: 6,
                alignItems: 'flex-start',
                cursor: 'pointer',
              }}
            >
              <input
                type="checkbox"
                name="migrate"
                value="1"
                defaultChecked
                style={{ marginTop: 4 }}
              />
              <span>
                Mover as questões e progresso que você já criou neste
                navegador para a nova conta. (Recomendado.)
              </span>
            </label>
          </div>
        )}

        <label>
          <span>Email</span>
          <input
            type="email"
            name="email"
            autoComplete="email"
            required
            autoFocus
          />
        </label>

        <label>
          <span>Senha (mín. 8 caracteres)</span>
          <input
            type="password"
            name="password"
            autoComplete="new-password"
            minLength={8}
            required
          />
        </label>

        <label>
          <span>Repita a senha</span>
          <input
            type="password"
            name="password2"
            autoComplete="new-password"
            minLength={8}
            required
          />
        </label>

        {state.error && <div className="auth-error">{state.error}</div>}
        {state.message && <div className="auth-success">{state.message}</div>}

        <SubmitButton />

        <p className="auth-foot">
          Já tem conta? <Link href="/login">Entrar</Link>
        </p>

        {!isGuest && (
          <>
            <hr
              style={{
                margin: '14px 0 12px',
                border: 0,
                borderTop: '1px solid var(--border)',
              }}
            />
            <GuestSubmit />
            <p className="muted" style={{ fontSize: '0.78rem', marginTop: 4 }}>
              Demo local — dados ficam só neste navegador.
            </p>
          </>
        )}
      </form>
    </main>
  );
}
