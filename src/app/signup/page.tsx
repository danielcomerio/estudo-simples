'use client';

import { useFormState, useFormStatus } from 'react-dom';
import Link from 'next/link';
import { signup, type AuthState } from '../auth/actions';

const initial: AuthState = { error: null, message: null };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="primary" disabled={pending}>
      {pending ? 'Criando…' : 'Criar conta'}
    </button>
  );
}

export default function SignupPage() {
  const [state, formAction] = useFormState(signup, initial);

  return (
    <main className="auth-shell">
      <form action={formAction} className="auth-form">
        <h1>Criar conta</h1>
        <p className="muted">Crie sua instância pessoal de estudo.</p>

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
      </form>
    </main>
  );
}
