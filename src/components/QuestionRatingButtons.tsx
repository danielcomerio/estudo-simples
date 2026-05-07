'use client';

import { useEffect, useState } from 'react';
import { toast } from './Toast';

/**
 * Botões 👍/👎 pra rating de qualidade de questão. Plugar em runners
 * após resposta.
 *
 * Persiste server-side (question_ratings table). Toggle: clicar de novo
 * remove. Clicar no oposto troca.
 */
export function QuestionRatingButtons({ questionId }: { questionId: string }) {
  const [my, setMy] = useState<1 | -1 | null>(null);
  const [ups, setUps] = useState(0);
  const [downs, setDowns] = useState(0);
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch(
          `/api/question-rating?question_id=${encodeURIComponent(questionId)}`
        );
        const json = await res.json();
        setUps(json.ups ?? 0);
        setDowns(json.downs ?? 0);
        setMy(json.my ?? null);
      } catch {}
      setLoaded(true);
    })();
  }, [questionId]);

  const rate = async (newRating: 1 | -1) => {
    if (busy) return;
    setBusy(true);
    const wasMy = my;
    try {
      if (my === newRating) {
        // Remove
        const res = await fetch(
          `/api/question-rating?question_id=${encodeURIComponent(questionId)}`,
          { method: 'DELETE' }
        );
        if (!res.ok) throw new Error('delete_failed');
        setMy(null);
        if (newRating === 1) setUps((u) => Math.max(0, u - 1));
        else setDowns((d) => Math.max(0, d - 1));
      } else {
        // Set/troca
        const res = await fetch('/api/question-rating', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ question_id: questionId, rating: newRating }),
        });
        if (!res.ok) throw new Error('post_failed');
        setMy(newRating);
        if (newRating === 1) {
          setUps((u) => u + 1);
          if (wasMy === -1) setDowns((d) => Math.max(0, d - 1));
        } else {
          setDowns((d) => d + 1);
          if (wasMy === 1) setUps((u) => Math.max(0, u - 1));
        }
      }
    } catch {
      toast('Erro ao avaliar', 'error');
    } finally {
      setBusy(false);
    }
  };

  if (!loaded) return null;

  return (
    <div
      className="row gap"
      style={{
        alignItems: 'center',
        marginTop: 6,
        fontSize: '0.85rem',
      }}
      role="group"
      aria-label="Avaliar qualidade da questão"
    >
      <button
        type="button"
        onClick={() => void rate(1)}
        disabled={busy}
        title="Boa questão"
        aria-label="Marcar como boa questão"
        aria-pressed={my === 1}
        style={{
          padding: '4px 10px',
          background: my === 1 ? 'var(--primary-soft)' : undefined,
          borderColor: my === 1 ? 'var(--primary)' : undefined,
          color: my === 1 ? 'var(--primary)' : undefined,
        }}
      >
        👍 {ups > 0 && <strong>{ups}</strong>}
      </button>
      <button
        type="button"
        onClick={() => void rate(-1)}
        disabled={busy}
        title="Questão problemática"
        aria-label="Marcar como questão problemática"
        aria-pressed={my === -1}
        style={{
          padding: '4px 10px',
          background:
            my === -1 ? 'var(--warn-bg, rgba(217,119,6,0.12))' : undefined,
          borderColor: my === -1 ? 'var(--warn, #d97706)' : undefined,
          color: my === -1 ? 'var(--warn, #d97706)' : undefined,
        }}
      >
        👎 {downs > 0 && <strong>{downs}</strong>}
      </button>
    </div>
  );
}
