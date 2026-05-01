'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  HierarchyValidationError,
  ensureDisciplinasExist,
  updateDisciplina,
  useAllConcursoDisciplinas,
  useDisciplinas,
  type DisciplinaInput,
} from '@/lib/hierarchy';
import { selectActiveQuestions, selectDisciplinas, useStore } from '@/lib/store';
import type { Disciplina } from '@/lib/types';
import { toast } from './Toast';

/**
 * Página de disciplinas — read-only no que toca a CRIAR ou EXCLUIR.
 *
 * Modelo conceitual: disciplinas são DERIVADAS das questões. Você não
 * cria uma disciplina manualmente; ela aparece sozinha quando você
 * importa uma questão com `disciplina_id = "x"` novo. Aqui você pode
 * apenas editar METADATA (cor, peso default).
 *
 * Por que essa decisão: feedback do user — ele excluiu disciplinas
 * pensando que afetava só o vínculo com o concurso, e perdeu o "menu"
 * pra escolher quais entrar no concurso. Auto-derivar elimina toda
 * essa fonte de confusão.
 */
export function DisciplinasSection() {
  const { data, loading, error } = useDisciplinas();
  const { data: vinculos } = useAllConcursoDisciplinas();
  const allQuestions = useStore(selectActiveQuestions);
  const disciplinasNasQuestoes = useStore(selectDisciplinas);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Conta vínculos com concursos por disciplina_id (UUID)
  const vinculosByDisc = useMemo(() => {
    const m = new Map<string, number>();
    for (const v of vinculos) {
      m.set(v.disciplina_id, (m.get(v.disciplina_id) ?? 0) + 1);
    }
    return m;
  }, [vinculos]);

  // Garante que toda disciplina das questões tem registro na tabela.
  // Roda no mount + quando a lista muda (ex: import recente).
  useEffect(() => {
    if (!data || disciplinasNasQuestoes.length === 0) return;
    const existentesLower = new Set(data.map((d) => d.nome.toLowerCase()));
    const faltantes = disciplinasNasQuestoes.filter(
      (n) => !existentesLower.has(n.toLowerCase())
    );
    if (faltantes.length === 0) return;
    void ensureDisciplinasExist(faltantes);
  }, [data, disciplinasNasQuestoes]);

  // Conta questões ativas por disciplina (case-insensitive)
  const countByDisc = useMemo(() => {
    const m = new Map<string, number>();
    for (const q of allQuestions) {
      if (!q.disciplina_id) continue;
      const k = q.disciplina_id.toLowerCase();
      m.set(k, (m.get(k) ?? 0) + 1);
    }
    return m;
  }, [allQuestions]);

  const handleEditSubmit = async (
    input: DisciplinaInput,
    onDone: () => void
  ): Promise<void> => {
    if (!editingId) return;
    try {
      // Não permite renomear via UI — nome é a chave que liga questões à
      // tabela. Renomear quebra o filtro até questions.disciplina_id ser
      // atualizado também. Limita a peso/cor.
      const safeInput: Partial<DisciplinaInput> = {
        peso_default: input.peso_default,
        cor: input.cor,
      };
      await updateDisciplina(editingId, safeInput);
      toast('Disciplina atualizada', 'success');
      onDone();
      setEditingId(null);
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

  return (
    <section className="card">
      <div className="row between" style={{ marginBottom: 12 }}>
        <h2 style={{ margin: 0 }}>
          Disciplinas{' '}
          {data ? <span className="muted">({data.length})</span> : null}
        </h2>
      </div>

      <p
        className="muted"
        style={{ marginTop: -4, marginBottom: 12, fontSize: '0.9rem' }}
      >
        Disciplinas são detectadas automaticamente das suas questões — não
        crie nem exclua aqui. Cada questão importada com{' '}
        <code>disciplina_id</code> novo gera uma entrada. Você pode editar
        cor e peso default pra organização visual.
      </p>

      {loading && data === null && <p className="muted">Carregando…</p>}
      {error && (
        <p className="muted" role="alert">
          Erro ao carregar: {error}
        </p>
      )}

      {data && data.length === 0 && (
        <p className="empty">
          Nenhuma disciplina detectada ainda. Importe questões em{' '}
          <code>/banco</code> para começar.
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
                <DisciplinaMetadataForm
                  initial={{
                    nome: d.nome,
                    peso_default: d.peso_default,
                    cor: d.cor,
                  }}
                  onSubmit={handleEditSubmit}
                  onCancel={() => setEditingId(null)}
                />
              </li>
            ) : (
              <DisciplinaRow
                key={d.id}
                disciplina={d}
                qtdQuestoes={countByDisc.get(d.nome.toLowerCase()) ?? 0}
                qtdConcursos={vinculosByDisc.get(d.id) ?? 0}
                onEdit={() => setEditingId(d.id)}
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
  qtdQuestoes,
  qtdConcursos,
  onEdit,
}: {
  disciplina: Disciplina;
  qtdQuestoes: number;
  qtdConcursos: number;
  onEdit: () => void;
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
            <div
              className="muted"
              style={{ fontSize: '0.82rem', marginTop: 2 }}
            >
              {qtdQuestoes} questão(ões) no banco
              {qtdConcursos > 0 && ` · vinculada a ${qtdConcursos} concurso(s)`}
              {d.peso_default != null && ` · peso default ${d.peso_default}`}
            </div>
          </div>
        </div>
        <div className="row gap">
          <button type="button" className="ghost" onClick={onEdit}>
            Editar
          </button>
        </div>
      </div>
    </li>
  );
}

function DisciplinaMetadataForm({
  initial,
  onSubmit,
  onCancel,
}: {
  initial: DisciplinaInput;
  onSubmit: (input: DisciplinaInput, onDone: () => void) => Promise<void>;
  onCancel: () => void;
}) {
  const [pesoStr, setPesoStr] = useState(
    initial.peso_default != null ? String(initial.peso_default) : ''
  );
  const [cor, setCor] = useState(initial.cor ?? '');
  const [submitting, setSubmitting] = useState(false);

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
        nome: initial.nome, // não editável
        peso_default: peso,
        cor: cor.trim() ? cor.trim() : null,
      },
      () => undefined
    );
    setSubmitting(false);
  };

  return (
    <form
      onSubmit={submit}
      style={{
        background: 'var(--bg-elev-2)',
        border: '1px solid var(--primary)',
        borderRadius: 'var(--radius)',
        padding: 14,
      }}
    >
      <p className="muted" style={{ marginTop: 0, fontSize: '0.85rem' }}>
        Editando <strong>{initial.nome}</strong>. Nome não pode ser alterado
        — ele é a chave que liga questões a essa disciplina.
      </p>
      <div className="form-grid">
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
          {submitting ? 'Salvando…' : 'Salvar'}
        </button>
      </div>
    </form>
  );
}
