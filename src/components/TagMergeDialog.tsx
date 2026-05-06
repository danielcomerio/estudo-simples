'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { selectActiveQuestions, updateQuestionLocal, useStore } from '@/lib/store';
import { scheduleSync } from '@/lib/sync';
import { toast } from './Toast';
import { confirmDialog } from './ConfirmDialog';

/**
 * Dialog pra renomear/unificar tag. User seleciona origem + destino.
 * Aplica em massa em todas as questões: remove origem, adiciona destino.
 *
 * Útil pra limpar inconsistências (ex: "art_5" + "art-5" + "art 5" → "art-5").
 */
export function TagMergeDialog({
  onClose,
}: {
  onClose: () => void;
}) {
  const allQuestions = useStore(selectActiveQuestions);
  const dlgRef = useRef<HTMLDialogElement>(null);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (dlgRef.current && !dlgRef.current.open) {
      try {
        dlgRef.current.showModal();
      } catch {
        onClose();
      }
    }
  }, [onClose]);

  // Lista tags existentes com count
  const tagsList = useMemo(() => {
    const m = new Map<string, number>();
    for (const q of allQuestions) {
      for (const t of q.tags ?? []) {
        m.set(t, (m.get(t) ?? 0) + 1);
      }
    }
    return Array.from(m.entries()).sort((a, b) => b[1] - a[1]);
  }, [allQuestions]);

  const fromCount = useMemo(
    () => tagsList.find(([t]) => t === from)?.[1] ?? 0,
    [tagsList, from]
  );

  const close = () => {
    if (dlgRef.current?.open) dlgRef.current.close();
    onClose();
  };

  const apply = async () => {
    const fromTrim = from.trim();
    const toTrim = to.trim();
    if (!fromTrim) {
      toast('Informe a tag de origem', 'error');
      return;
    }
    if (fromTrim === toTrim) {
      toast('Origem e destino são iguais — sem efeito', 'warn');
      return;
    }
    const affected = allQuestions.filter((q) => q.tags?.includes(fromTrim));
    if (affected.length === 0) {
      toast(`Nenhuma questão tem tag "${fromTrim}"`, 'warn');
      return;
    }
    const action = toTrim
      ? `Renomear tag "${fromTrim}" → "${toTrim}"`
      : `Remover tag "${fromTrim}"`;
    const ok = await confirmDialog({
      title: action,
      message: `Aplicar em ${affected.length} questão(ões)?`,
    });
    if (!ok) return;
    setSubmitting(true);
    try {
      for (const q of affected) {
        const cur = q.tags ?? [];
        const next = cur.filter((t) => t !== fromTrim);
        if (toTrim && !next.includes(toTrim)) next.push(toTrim);
        updateQuestionLocal(q.id, { tags: next });
      }
      scheduleSync(500);
      toast(
        toTrim
          ? `${affected.length} questão(ões) atualizada(s).`
          : `Tag removida em ${affected.length} questão(ões).`,
        'success'
      );
      close();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <dialog
      ref={dlgRef}
      onClose={onClose}
      style={{
        background: 'var(--bg-elev)',
        color: 'var(--text)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)',
        padding: 20,
        maxWidth: 480,
        width: '90vw',
      }}
    >
      <div className="row between" style={{ marginBottom: 12 }}>
        <h2 style={{ margin: 0 }}>🏷 Mesclar / renomear tag</h2>
        <button
          type="button"
          className="ghost icon"
          onClick={close}
          aria-label="Fechar"
        >
          ✕
        </button>
      </div>
      <p
        className="muted"
        style={{ margin: '0 0 14px', fontSize: '0.88rem' }}
      >
        Substitui (ou remove) uma tag em todas as questões que a têm.
        Útil pra limpar duplicatas ("art_5", "art-5").
      </p>
      <label
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
          marginBottom: 10,
        }}
      >
        <span style={{ fontSize: '0.85rem' }}>Tag origem (será substituída) *</span>
        <input
          type="text"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
          list="all-tags-merge"
          placeholder="ex: art_5"
        />
        <datalist id="all-tags-merge">
          {tagsList.map(([t, n]) => (
            <option key={t} value={t}>
              {n} questão(ões)
            </option>
          ))}
        </datalist>
        {from && fromCount > 0 && (
          <span className="muted" style={{ fontSize: '0.78rem' }}>
            {fromCount} questão(ões) afetada(s)
          </span>
        )}
      </label>
      <label
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
          marginBottom: 14,
        }}
      >
        <span style={{ fontSize: '0.85rem' }}>
          Tag destino (deixe vazio pra apenas remover)
        </span>
        <input
          type="text"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          list="all-tags-merge"
          placeholder="ex: art-5 (vazio = só remover origem)"
        />
      </label>
      <div className="row gap right">
        <button type="button" className="ghost" onClick={close}>
          Cancelar
        </button>
        <button
          type="button"
          className="primary"
          onClick={() => void apply()}
          disabled={submitting || !from.trim()}
        >
          {to.trim() ? 'Mesclar' : 'Remover'}
        </button>
      </div>
    </dialog>
  );
}
