'use client';

import { toast } from './Toast';

/**
 * Botão pequeno que compartilha o streak via Web Share API (Android,
 * iOS, alguns desktops). Fallback: copia texto pro clipboard.
 *
 * Mostrado só quando streak >= 3 (não tem graça compartilhar 1 dia).
 */
export function ShareStreakButton({ streak }: { streak: number }) {
  if (streak < 3) return null;

  const share = async () => {
    const text = `🔥 Estou em ${streak} dias de streak no Estudo Simples! Repetição espaçada pra concursos. https://estudo-simples.app`;
    try {
      if (typeof navigator !== 'undefined' && 'share' in navigator) {
        await navigator.share({ text });
        return;
      }
    } catch (e) {
      if ((e as Error).name === 'AbortError') return; // user cancelou
    }
    // Fallback: clipboard
    try {
      await navigator.clipboard.writeText(text);
      toast('Texto copiado pro clipboard', 'success');
    } catch {
      toast('Não consegui compartilhar', 'error');
    }
  };

  return (
    <button
      type="button"
      onClick={share}
      title="Compartilhar streak"
      aria-label="Compartilhar streak"
      style={{
        padding: '4px 10px',
        background: 'transparent',
        border: '1px solid var(--border)',
        borderRadius: 6,
        color: 'var(--muted)',
        cursor: 'pointer',
        fontSize: '0.78rem',
        marginLeft: 8,
      }}
    >
      📤 Compartilhar
    </button>
  );
}
