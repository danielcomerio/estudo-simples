'use client';

import { useState } from 'react';
import { toast } from './Toast';

export function ShareProgressButton({
  streak,
  total,
  acerto,
  dominadas,
}: {
  streak: number;
  total: number;
  acerto: number;
  dominadas: number;
}) {
  const [busy, setBusy] = useState(false);

  async function share() {
    const params = new URLSearchParams({
      streak: String(streak),
      total: String(total),
      acerto: String(acerto),
      dominadas: String(dominadas),
    });
    const imageUrl = `${window.location.origin}/api/share-card?${params.toString()}`;
    const text = `📊 Meu progresso no Estudo Simples:\n🔥 Streak ${streak} dias · 🎯 ${total} revisões · 💎 ${acerto}% acerto · 🏆 ${dominadas} dominadas\n${window.location.origin}`;

    setBusy(true);
    try {
      // Web Share API (mobile) — passa URL + texto
      const nav = navigator as Navigator & {
        share?: (data: ShareData) => Promise<void>;
      };
      if (nav.share) {
        await nav.share({
          title: 'Meu progresso · Estudo Simples',
          text,
          url: imageUrl,
        });
        return;
      }

      // Fallback desktop: copia link pro clipboard
      await navigator.clipboard.writeText(`${text}\n${imageUrl}`);
      toast('Link copiado pra área de transferência!', 'success');
    } catch (e) {
      // User cancelou Web Share = AbortError, ignorável
      if ((e as Error).name !== 'AbortError') {
        toast(`Falha: ${(e as Error).message}`, 'error');
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      onClick={() => void share()}
      disabled={busy}
      title="Compartilhar progresso"
      style={{ padding: '6px 14px', fontSize: '0.88rem' }}
    >
      📤 Compartilhar
    </button>
  );
}
