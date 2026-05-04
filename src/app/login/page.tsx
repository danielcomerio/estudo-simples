'use client';

import { Suspense } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
// useFormStatus só lê pending do form pai — quando GuestSubmit estiver
// dentro do form de login, é normal que o pending seja do login.
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
  return (
    <button
      type="submit"
      className="ghost"
      // formAction override + formNoValidate skipa required do form pai
      formAction={enterAsGuest}
      formNoValidate
      style={{ width: '100%' }}
      title="Acessa sem criar conta. Os dados ficam só neste navegador."
    >
      👤 Entrar como visitante
    </button>
  );
}

function LoginForm() {
  const [state, formAction] = useFormState(login, initial);
  const params = useSearchParams();
  const next = params.get('next') || '/';

  return (
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
    </form>
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
