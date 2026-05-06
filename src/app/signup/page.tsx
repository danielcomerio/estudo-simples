'use client';

import { useFormState, useFormStatus } from 'react-dom';
import Link from 'next/link';
import { enterAsGuest, resendConfirmation, signup, type AuthState } from '../auth/actions';
import { useIsGuest } from '@/lib/settings';
import { PasswordInput } from '@/components/PasswordInput';

const initial: AuthState = { error: null, message: null };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="primary" disabled={pending}>
      {pending ? 'Criando…' : 'Criar conta'}
    </button>
  );
}

function ResendBlock() {
  const [state, action] = useFormState(resendConfirmation, initial);
  const { pending } = useFormStatus();
  return (
    <details
      style={{
        marginTop: 12,
        padding: '10px 12px',
        background: 'var(--bg-elev-2)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius)',
        fontSize: '0.88rem',
      }}
    >
      <summary style={{ cursor: 'pointer', fontWeight: 500 }}>
        Email não chegou? Reenviar confirmação
      </summary>
      <form action={action} style={{ marginTop: 10 }}>
        <input
          type="email"
          name="email"
          placeholder="seu@email.com"
          required
          style={{ width: '100%', padding: '8px 10px', marginBottom: 8 }}
        />
        {state.error && (
          <div className="auth-error" style={{ fontSize: '0.82rem' }}>
            {state.error}
          </div>
        )}
        {state.message && (
          <div className="auth-success" style={{ fontSize: '0.82rem' }}>
            {state.message}
          </div>
        )}
        <button
          type="submit"
          className="ghost"
          disabled={pending}
          style={{ width: '100%' }}
        >
          {pending ? 'Reenviando…' : 'Reenviar email de confirmação'}
        </button>
        <p className="muted" style={{ fontSize: '0.78rem', marginTop: 6 }}>
          Não chega em 5min? Confira o spam ou tente outro email.
        </p>
      </form>
    </details>
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
          <PasswordInput name="password" autoComplete="new-password" />
        </label>

        <label>
          <span>Repita a senha</span>
          <PasswordInput name="password2" autoComplete="new-password" />
        </label>

        {state.error && <div className="auth-error">{state.error}</div>}
        {state.message && <div className="auth-success">{state.message}</div>}

        <SubmitButton />

        <p className="auth-foot">
          Já tem conta? <Link href="/login">Entrar</Link>
        </p>

        {state.message && (
          <ResendBlock />
        )}

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
