'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from './Toast';
import { confirmDialog } from './ConfirmDialog';
import { deleteQuestionLocal, updateQuestionLocal } from '@/lib/store';
import { scheduleSync } from '@/lib/sync';
import type { Question } from '@/lib/types';

/**
 * Menu de ações rápidas pra uma questão. Aparece como bottom sheet
 * (mobile) / popover (desktop). Disparado por long-press numa questão
 * do /banco. Click fora ou Esc fecha.
 *
 * Ações:
 *  - ▶ Estudar essa (abre /estudar com pool=[id])
 *  - ✏ Editar (callback do parent)
 *  - 📋 Copiar JSON
 *  - 🗑 Excluir (com confirmação)
 */
export function QuestionQuickActions({
  question,
  onClose,
  onEdit,
}: {
  question: Question | null;
  onClose: () => void;
  onEdit: (q: Question) => void;
}) {
  const router = useRouter();

  useEffect(() => {
    if (!question) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [question, onClose]);

  if (!question) return null;

  const studyOne = () => {
    router.push(
      `/estudar?modo=aleatorio&qtd=1&auto=1&ids=${encodeURIComponent(question.id)}`
    );
    onClose();
  };

  const copyJson = async () => {
    try {
      const json = JSON.stringify(question, null, 2);
      await navigator.clipboard.writeText(json);
      toast('JSON copiado', 'success');
      onClose();
    } catch {
      toast('Não consegui copiar', 'error');
    }
  };

  const remove = async () => {
    const ok = await confirmDialog({
      title: 'Excluir questão?',
      message: 'Essa ação pode ser desfeita via lixeira (90 dias).',
      danger: true,
    });
    if (!ok) return;
    const id = question.id;
    deleteQuestionLocal(id);
    scheduleSync(800);
    toast('Questão excluída', 'success', 8000, {
      label: 'Desfazer',
      onClick: () => {
        updateQuestionLocal(id, { deleted_at: null });
        scheduleSync(500);
        toast('Restaurada', 'success');
      },
    });
    onClose();
  };

  const enun =
    (question.payload as Record<string, unknown>).enunciado ??
    (question.payload as Record<string, unknown>).enunciado_completo ??
    (question.payload as Record<string, unknown>).texto ??
    (question.payload as Record<string, unknown>).frente ??
    '(sem texto)';
  const preview = String(enun).slice(0, 100);

  return (
    <div
      role="dialog"
      aria-modal
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 220,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
        padding: 16,
        animation: 'qqa-fade 180ms ease-out',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--bg-elev)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
          width: '100%',
          maxWidth: 480,
          padding: 16,
          boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
          animation: 'qqa-slide 220ms cubic-bezier(0.2, 0.7, 0.3, 1)',
        }}
      >
        <div
          className="muted"
          style={{
            fontSize: '0.78rem',
            marginBottom: 6,
          }}
        >
          {question.disciplina_id ?? '—'} · {question.type}
        </div>
        <div
          style={{
            fontSize: '0.92rem',
            marginBottom: 14,
            lineHeight: 1.4,
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {preview}
          {String(enun).length > 100 ? '…' : ''}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <ActionRow emoji="▶" label="Estudar essa" onClick={studyOne} />
          <ActionRow
            emoji="✏"
            label="Editar"
            onClick={() => {
              onEdit(question);
              onClose();
            }}
          />
          <ActionRow emoji="📋" label="Copiar JSON" onClick={copyJson} />
          <ActionRow
            emoji="🗑"
            label="Excluir"
            danger
            onClick={() => void remove()}
          />
        </div>
        <button
          type="button"
          className="ghost"
          onClick={onClose}
          style={{ marginTop: 12, width: '100%', padding: '10px' }}
        >
          Cancelar
        </button>
      </div>
      <style>{`
        @keyframes qqa-fade {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes qqa-slide {
          from { transform: translateY(20px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        @media (prefers-reduced-motion: reduce) {
          [role="dialog"] [aria-modal] { animation: none !important; }
        }
      `}</style>
    </div>
  );
}

function ActionRow({
  emoji,
  label,
  onClick,
  danger,
}: {
  emoji: string;
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        width: '100%',
        padding: '12px 14px',
        background: 'var(--bg-elev-2)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius)',
        color: danger ? 'var(--danger)' : 'var(--text)',
        cursor: 'pointer',
        fontSize: '0.95rem',
        textAlign: 'left',
      }}
    >
      <span style={{ fontSize: '1.2rem' }}>{emoji}</span>
      <span>{label}</span>
    </button>
  );
}
