'use client';

import { useState } from 'react';
import {
  HierarchyValidationError,
  createDisciplina,
  softDeleteDisciplina,
  updateDisciplina,
  useDisciplinas,
  type DisciplinaInput,
} from '@/lib/hierarchy';
import type { Disciplina } from '@/lib/types';
import { confirmDialog } from './ConfirmDialog';
import { toast } from './Toast';

const EMPTY_INPUT: DisciplinaInput = {
  nome: '',
  peso_default: null,
  cor: null,
};

export function DisciplinasSection() {
  const { data, loading, error } = useDisciplinas();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showNewForm, setShowNewForm] = useState(false);

  const handleSubmit = async (
    input: DisciplinaInput,
    onDone: () => void
  ): Promise<void> => {
    try {
      if (editingId) {
        await updateDisciplina(editingId, input);
        toast('Disciplina atualizada', 'success');
      } else {
        await createDisciplina(input);
        toast('Disciplina criada', 'success');
      }
      onDone();
      setEditingId(null);
      setShowNewForm(false);
    } catch (e: unknown) {
      const msg =
        e instanceof HierarchyValidationError
          ? `Validação: ${e.message}`
          : e instanceof Error
            ? e.message
            : 'Erro desconhecido';
      toast(msg, 'error');
    }
  };

  const handleDelete = async (d: Disciplina) => {
    const ok = await confirmDialog({
      title: 'Excluir disciplina',
      message: `Excluir "${d.nome}"? Tópicos vinculados serão removidos junto. Questões com disciplina_id como string continuam.`,
      danger: true,
    });
    if (!ok) return;
    try {
      await softDeleteDisciplina(d.id);
      toast('Disciplina excluída', 'success');
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : 'Erro ao excluir', 'error');
    }
  };

  return (
    <section className="card">
      <div className="row between" style={{ marginBottom: 12 }}>
        <h2 style={{ margin: 0 }}>
          Disciplinas{' '}
          {data ? <span className="muted">({data.length})</span> : null}
        </h2>
        {!showNewForm && !editingId && (
          <button
            type="button"
            className="primary"
            onClick={() => setShowNewForm(true)}
          >
            + Nova
          </button>
        )}
      </div>

      {showNewForm && (
        <DisciplinaForm
          initial={EMPTY_INPUT}
          submitLabel="Criar"
          onSubmit={handleSubmit}
          onCancel={() => setShowNewForm(false)}
        />
      )}

      {loading && data === null && <p className="muted">Carregando…</p>}
      {error && (
        <p className="muted" role="alert">
          Erro ao carregar: {error}
        </p>
      )}

      {data && data.length === 0 && !showNewForm && (
        <p className="empty">
          Nenhuma disciplina ainda. Crie pra começar a organizar tópicos e
          atribuir questões.
        </p>
      )}

      {data && data.length > 0 && (
        <ul
          style={{
            listStyle: 'none',
            padding: 0,
            margin: 0,
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
          }}
        >
          {data.map((d) =>
            editingId === d.id ? (
              <li key={d.id}>
                <DisciplinaForm
                  initial={{
                    nome: d.nome,
                    peso_default: d.peso_default,
                    cor: d.cor,
                  }}
                  submitLabel="Salvar"
                  onSubmit={handleSubmit}
                  onCancel={() => setEditingId(null)}
                />
              </li>
            ) : (
              <DisciplinaRow
                key={d.id}
                disciplina={d}
                onEdit={() => setEditingId(d.id)}
                onDelete={() => handleDelete(d)}
              />
            )
          )}
        </ul>
      )}
    </section>
  );
}

function DisciplinaRow({
  disciplina: d,
  onEdit,
  onDelete,
}: {
  disciplina: Disciplina;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <li
      style={{
        background: 'var(--bg-elev-2)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius)',
        padding: '12px 14px',
      }}
    >
      <div className="row between wrap gap">
        <div
          className="row gap"
          style={{ minWidth: 0, flex: '1 1 auto', alignItems: 'center' }}
        >
          {d.cor && (
            <span
              aria-hidden
              title={`cor ${d.cor}`}
              style={{
                width: 14,
                height: 14,
                borderRadius: 4,
                background: d.cor,
                border: '1px solid var(--border)',
                flexShrink: 0,
              }}
            />
          )}
          <div style={{ minWidth: 0 }}>
            <div
              style={{
                fontWeight: 600,
                fontSize: '1rem',
                wordBreak: 'break-word',
              }}
            >
              {d.nome}
            </div>
            {d.peso_default != null && (
              <div
                className="muted"
                style={{ fontSize: '0.82rem', marginTop: 2 }}
              >
                peso default: {d.peso_default}
              </div>
            )}
          </div>
        </div>
        <div className="row gap">
          <button type="button" className="ghost" onClick={onEdit}>
            Editar
          </button>
          <button type="button" className="danger" onClick={onDelete}>
            Excluir
          </button>
        </div>
      </div>
    </li>
  );
}

function DisciplinaForm({
  initial,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initial: DisciplinaInput;
  submitLabel: string;
  onSubmit: (input: DisciplinaInput, onDone: () => void) => Promise<void>;
  onCancel: () => void;
}) {
  const [nome, setNome] = useState(initial.nome);
  const [pesoStr, setPesoStr] = useState(
    initial.peso_default != null ? String(initial.peso_default) : ''
  );
  const [cor, setCor] = useState(initial.cor ?? '');
  const [submitting, setSubmitting] = useState(false);

  const reset = () => {
    setNome('');
    setPesoStr('');
    setCor('');
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);

    let peso: number | null = null;
    if (pesoStr.trim()) {
      const parsed = Number(pesoStr.replace(',', '.'));
      if (!Number.isFinite(parsed)) {
        toast('Peso default precisa ser um número', 'error');
        setSubmitting(false);
        return;
      }
      peso = parsed;
    }

    await onSubmit(
      {
        nome,
        peso_default: peso,
        cor: cor.trim() ? cor.trim() : null,
      },
      reset
    );
    setSubmitting(false);
  };

  return (
    <form
      onSubmit={submit}
      style={{
        background: 'var(--bg-elev-2)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius)',
        padding: 14,
        marginBottom: 12,
      }}
    >
      <div className="form-grid">
        <label>
          <span>Nome *</span>
          <input
            type="text"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            required
            maxLength={200}
            placeholder="Ex: Português"
            autoFocus
          />
        </label>
        <label>
          <span>Peso default</span>
          <input
            type="text"
            inputMode="decimal"
            value={pesoStr}
            onChange={(e) => setPesoStr(e.target.value)}
            placeholder="ex: 1.5"
          />
        </label>
        <label>
          <span>Cor (hex)</span>
          <div className="row gap" style={{ alignItems: 'center' }}>
            <input
              type="color"
              value={cor || '#22c55e'}
              onChange={(e) => setCor(e.target.value)}
              style={{ width: 50, padding: 0, height: 38 }}
            />
            <input
              type="text"
              value={cor}
              onChange={(e) => setCor(e.target.value)}
              maxLength={7}
              placeholder="#22c55e"
              style={{ flex: 1 }}
            />
            {cor && (
              <button
                type="button"
                className="ghost"
                onClick={() => setCor('')}
                title="Limpar cor"
              >
                ×
              </button>
            )}
          </div>
        </label>
      </div>

      <div className="row gap right">
        <button type="button" className="ghost" onClick={onCancel}>
          Cancelar
        </button>
        <button type="submit" className="primary" disabled={submitting}>
          {submitting ? 'Salvando…' : submitLabel}
        </button>
      </div>
    </form>
  );
}
