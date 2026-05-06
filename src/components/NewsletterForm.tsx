'use client';

import { useState } from 'react';
import { toast } from './Toast';

/**
 * Form pra captura de email. Self-contained — chama /api/newsletter.
 * `source` ajuda a entender de onde veio (landing-hero, footer, etc.).
 */
export function NewsletterForm({ source = 'unknown' }: { source?: string }) {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy || done) return;
    setBusy(true);
    try {
      const res = await fetch('/api/newsletter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), source }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        toast(
          json?.error === 'invalid_email'
            ? 'E-mail inválido. Confere e tenta de novo.'
            : json?.error === 'rate_limited'
              ? 'Muitas tentativas. Espera um pouco.'
              : 'Erro inesperado. Tenta de novo.',
          'error'
        );
        setBusy(false);
        return;
      }
      setDone(true);
      toast('Inscrito! Avisaremos novidades.', 'success');
    } catch {
      toast('Erro de rede.', 'error');
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <p
        className="muted"
        style={{ fontSize: '0.92rem', textAlign: 'center', margin: 0 }}
      >
        ✓ Pronto! Avisaremos por <strong>{email}</strong>.
      </p>
    );
  }

  return (
    <form
      onSubmit={submit}
      style={{
        display: 'flex',
        gap: 8,
        flexWrap: 'wrap',
        justifyContent: 'center',
        maxWidth: 460,
        margin: '0 auto',
      }}
    >
      <input
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="seu@email.com"
        autoComplete="email"
        disabled={busy}
        style={{ flex: 1, minWidth: 220, padding: '10px 12px' }}
      />
      <button
        type="submit"
        className="primary"
        disabled={busy || !email}
        style={{ padding: '10px 18px' }}
      >
        {busy ? '…' : 'Avise-me'}
      </button>
    </form>
  );
}
