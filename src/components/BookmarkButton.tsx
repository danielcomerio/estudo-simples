'use client';

import { updateQuestionLocal } from '@/lib/store';
import { scheduleSync } from '@/lib/sync';
import { haptic } from '@/lib/haptic';
import type { Question } from '@/lib/types';

/**
 * Toggle de favorita ⭐ pra uma questão. Persiste em payload.bookmarked
 * (boolean opt-in). Usado no /banco e no QuestionEditDrawer.
 *
 * Note: payload é jsonb, então não precisa migration. Sync envia tudo.
 */
export function BookmarkButton({
  question,
  size = 'normal',
}: {
  question: Question;
  size?: 'normal' | 'small';
}) {
  const payload = question.payload as Record<string, unknown>;
  const bookmarked = payload.bookmarked === true;

  const toggle = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    haptic('select');
    updateQuestionLocal(question.id, (q) => ({
      payload: {
        ...(q.payload as Record<string, unknown>),
        bookmarked: !bookmarked,
      },
    }));
    scheduleSync(800);
  };

  const fontSize = size === 'small' ? '0.95rem' : '1.05rem';

  return (
    <button
      type="button"
      onClick={toggle}
      title={bookmarked ? 'Desfavoritar' : 'Favoritar'}
      aria-label={bookmarked ? 'Desfavoritar' : 'Favoritar'}
      aria-pressed={bookmarked}
      style={{
        background: 'transparent',
        border: 'none',
        padding: '2px 4px',
        cursor: 'pointer',
        fontSize,
        lineHeight: 1,
        color: bookmarked ? '#facc15' : 'var(--muted)',
        transition: 'transform 120ms, color 120ms',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'scale(1.15)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'scale(1)';
      }}
    >
      {bookmarked ? '⭐' : '☆'}
    </button>
  );
}
