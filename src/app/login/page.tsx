'use client';

import { Suspense } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { enterAsGuest, login, type AuthState } from '../auth/actions';

const initial: AuthState = { error: null, message: null };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="primary" disabled={pending}>
      {pending ? 'Entrando…' : 'Entrar'}
    </button>
  );
}

function GuestSubmit() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      className="ghost"
      disabled={pending}
      style={{ width: '100%' }}
      title="Acessa sem criar conta. Os dados ficam só neste navegador."
    >
      {pending ? 'Entrando…' : '👤 Entrar como visitante'}
    </button>
  );
}

function LoginForm() {
  const [state, formAction] = useFormState(login, initial);
  const params = useSearchParams();
  const next = params.get('next') || '/';

  return (
    <>
      <form action={formAction} className="auth-form">
        <h1>Entrar</h1>
        <p className="muted">Acesse seu banco de questões.</p>

        <input type="hidden" name="next" value={next} />

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
          <span>Senha</span>
          <input
            type="password"
            name="password"
            autoComplete="current-password"
            required
          />
        </label>

        {state.error && <div className="auth-error">{state.error}</div>}

        <SubmitButton />

        <p className="auth-foot">
          Sem conta?{' '}
          <Link
            href={`/signup${next !== '/' ? `?next=${encodeURIComponent(next)}` : ''}`}
          >
            Criar conta
          </Link>
        </p>
      </form>

      <form
        action={enterAsGuest}
        className="auth-form"
        style={{ marginTop: 14 }}
      >
        <hr
          style={{
            margin: '0 0 14px',
            border: 0,
            borderTop: '1px solid var(--border)',
          }}
        />
        <GuestSubmit />
        <p className="muted" style={{ fontSize: '0.78rem', marginTop: 6 }}>
          Demo local — dados ficam só neste navegador.
        </p>
      </form>
    </>
  );
}

export default function LoginPage() {
  return (
    <main className="auth-shell">
      <Suspense
        fallback={
          <div className="auth-form">
            <h1>Entrar</h1>
          </div>
        }
      >
        <LoginForm />
      </Suspense>
    </main>
  );
}
