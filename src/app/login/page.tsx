'use client';

import { Suspense } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { login, type AuthState } from '../auth/actions';

const initial: AuthState = { error: null, message: null };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="primary" disabled={pending}>
      {pending ? 'Entrando…' : 'Entrar'}
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
        Sem conta? <Link href={`/signup${next !== '/' ? `?next=${encodeURIComponent(next)}` : ''}`}>Criar conta</Link>
      </p>
    </form>
  );
}

export default function LoginPage() {
  return (
    <main className="auth-shell">
      <Suspense fallback={<div className="auth-form"><h1>Entrar</h1></div>}>
        <LoginForm />
      </Suspense>
    </main>
  );
}
