'use client';

import { useState } from 'react';
import {
  HierarchyValidationError,
  createConcurso,
  softDeleteConcurso,
  updateConcurso,
  useConcursoDisciplinas,
  useConcursos,
  type ConcursoInput,
} from '@/lib/hierarchy';
import type { Concurso, ConcursoStatus } from '@/lib/types';
import { ConcursoDisciplinasManager } from './ConcursoDisciplinasManager';
import { confirmDialog } from './ConfirmDialog';
import { toast } from './Toast';

const STATUS_LABEL: Record<ConcursoStatus, string> = {
  ativo: 'Ativo',
  arquivado: 'Arquivado',
  concluido: 'Concluído',
};

const EMPTY_INPUT: ConcursoInput = {
  nome: '',
  banca: '',
  orgao: '',
  cargo: '',
  data_prova: '',
  status: 'ativo',
  edital_url: '',
  notas: '',
};

export function ConcursosSection() {
  const { data, loading, error } = useConcursos();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showNewForm, setShowNewForm] = useState(false);

  const handleSubmit = async (
    input: ConcursoInput,
    onDone: () => void
  ): Promise<void> => {
    try {
      if (editingId) {
        await updateConcurso(editingId, input);
        toast('Concurso atualizado', 'success');
      } else {
        await createConcurso(input);
        toast('Concurso criado', 'success');
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

  const handleDelete = async (c: Concurso) => {
    const ok = await confirmDialog({
      title: 'Excluir concurso',
      message: `Excluir "${c.nome}"? As questões vinculadas perderão o vínculo, mas continuarão no banco.`,
      danger: true,
    });
    if (!ok) return;
    try {
      await softDeleteConcurso(c.id);
      toast('Concurso excluído', 'success');
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : 'Erro ao excluir', 'error');
    }
  };

  return (
    <section className="card">
      <div className="row between" style={{ marginBottom: 12 }}>
        <h2 style={{ margin: 0 }}>
          Concursos {data ? <span className="muted">({data.length})</span> : null}
        </h2>
        {!showNewForm && !editingId && (
          <button
            type="button"
            className="primary"
            onClick={() => setShowNewForm(true)}
          >
            + Novo
          </button>
        )}
      </div>

      {showNewForm && (
        <ConcursoForm
          initial={EMPTY_INPUT}
          submitLabel="Criar"
          onSubmit={handleSubmit}
          onCancel={() => setShowNewForm(false)}
        />
      )}

      {loading && data === null && (
        <p className="muted">Carregando…</p>
      )}
      {error && (
        <p className="muted" role="alert">
          Erro ao carregar: {error}
        </p>
      )}

      {data && data.length === 0 && !showNewForm && (
        <p className="empty">
          Nenhum concurso ainda. Crie o primeiro pra organizar suas questões
          por prova.
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
          {data.map((c) =>
            editingId === c.id ? (
              <li key={c.id}>
                <ConcursoForm
                  initial={{
                    nome: c.nome,
                    banca: c.banca ?? '',
                    orgao: c.orgao ?? '',
                    cargo: c.cargo ?? '',
                    data_prova: c.data_prova ?? '',
                    status: c.status,
                    edital_url: c.edital_url ?? '',
                    notas: c.notas ?? '',
                  }}
                  submitLabel="Salvar"
                  onSubmit={handleSubmit}
                  onCancel={() => setEditingId(null)}
                />
              </li>
            ) : (
              <ConcursoRow
                key={c.id}
                concurso={c}
                onEdit={() => setEditingId(c.id)}
                onDelete={() => handleDelete(c)}
              />
            )
          )}
        </ul>
      )}
    </section>
  );
}

function ConcursoRow({
  concurso: c,
  onEdit,
  onDelete,
}: {
  concurso: Concurso;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  // O hook compartilha cache global — todas as instâncias filtram da mesma
  // cache. Volume baixo (dezenas de vínculos por user) torna o overhead
  // desprezível.
  const { data: vinculos } = useConcursoDisciplinas(c.id);
  const sub = [c.banca, c.orgao, c.cargo].filter(Boolean).join(' · ');
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
        <div style={{ minWidth: 0, flex: '1 1 auto' }}>
          <div
            style={{
              fontWeight: 600,
              fontSize: '1rem',
              wordBreak: 'break-word',
            }}
          >
            {c.nome}
          </div>
          {sub && (
            <div
              className="muted"
              style={{ fontSize: '0.88rem', marginTop: 2 }}
            >
              {sub}
            </div>
          )}
          <div
            className="muted"
            style={{ fontSize: '0.82rem', marginTop: 4 }}
          >
            {STATUS_LABEL[c.status]}
            {c.data_prova && ` · prova em ${c.data_prova}`}
            {vinculos.length > 0 && ` · ${vinculos.length} disciplina(s)`}
          </div>
        </div>
        <div className="row gap">
          <button
            type="button"
            className="ghost"
            onClick={() => setExpanded((v) => !v)}
            aria-expanded={expanded}
          >
            {expanded ? '▾ Disciplinas' : '▸ Disciplinas'}
          </button>
          <button type="button" className="ghost" onClick={onEdit}>
            Editar
          </button>
          <button type="button" className="danger" onClick={onDelete}>
            Excluir
          </button>
        </div>
      </div>

      {expanded && <ConcursoDisciplinasManager concursoId={c.id} />}
    </li>
  );
}

function ConcursoForm({
  initial,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initial: ConcursoInput;
  submitLabel: string;
  onSubmit: (input: ConcursoInput, onDone: () => void) => Promise<void>;
  onCancel: () => void;
}) {
  const [nome, setNome] = useState(initial.nome);
  const [banca, setBanca] = useState(initial.banca ?? '');
  const [orgao, setOrgao] = useState(initial.orgao ?? '');
  const [cargo, setCargo] = useState(initial.cargo ?? '');
  const [dataProva, setDataProva] = useState(initial.data_prova ?? '');
  const [status, setStatus] = useState<ConcursoStatus>(
    initial.status ?? 'ativo'
  );
  const [editalUrl, setEditalUrl] = useState(initial.edital_url ?? '');
  const [notas, setNotas] = useState(initial.notas ?? '');
  const [submitting, setSubmitting] = useState(false);

  const reset = () => {
    setNome('');
    setBanca('');
    setOrgao('');
    setCargo('');
    setDataProva('');
    setStatus('ativo');
    setEditalUrl('');
    setNotas('');
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    await onSubmit(
      {
        nome,
        banca,
        orgao,
        cargo,
        data_prova: dataProva,
        status,
        edital_url: editalUrl,
        notas,
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
            placeholder="Ex: TJ-RJ Analista 2026"
            autoFocus
          />
        </label>
        <label>
          <span>Banca</span>
          <input
            type="text"
            value={banca}
            onChange={(e) => setBanca(e.target.value)}
            maxLength={100}
            placeholder="Ex: FGV"
          />
        </label>
        <label>
          <span>Órgão</span>
          <input
            type="text"
            value={orgao}
            onChange={(e) => setOrgao(e.target.value)}
            maxLength={200}
          />
        </label>
        <label>
          <span>Cargo</span>
          <input
            type="text"
            value={cargo}
            onChange={(e) => setCargo(e.target.value)}
            maxLength={200}
          />
        </label>
        <label>
          <span>Data da prova</span>
          <input
            type="date"
            value={dataProva}
            onChange={(e) => setDataProva(e.target.value)}
          />
        </label>
        <label>
          <span>Status</span>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as ConcursoStatus)}
          >
            <option value="ativo">Ativo</option>
            <option value="arquivado">Arquivado</option>
            <option value="concluido">Concluído</option>
          </select>
        </label>
      </div>

      <label
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
          marginBottom: 14,
        }}
      >
        <span style={{ fontSize: '0.85rem' }}>URL do edital</span>
        <input
          type="url"
          value={editalUrl}
          onChange={(e) => setEditalUrl(e.target.value)}
          maxLength={2048}
          placeholder="https://..."
        />
      </label>

      <label
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
          marginBottom: 14,
        }}
      >
        <span style={{ fontSize: '0.85rem' }}>Notas</span>
        <textarea
          value={notas}
          onChange={(e) => setNotas(e.target.value)}
          maxLength={10000}
          rows={3}
        />
      </label>

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
