'use client';

import { useMemo, useState } from 'react';
import {
  HierarchyValidationError,
  createTopico,
  softDeleteTopico,
  updateTopico,
  useDisciplinas,
  useTopicos,
  type TopicoInput,
} from '@/lib/hierarchy';
import type { Disciplina, Topico } from '@/lib/types';
import { confirmDialog } from './ConfirmDialog';
import { toast } from './Toast';

const EMPTY_INPUT = (disciplinaId: string): TopicoInput => ({
  nome: '',
  disciplina_id: disciplinaId,
  parent_topico_id: null,
  ordem: 0,
});

export function TopicosSection() {
  const { data: topicos, loading, error } = useTopicos();
  const { data: disciplinas } = useDisciplinas();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showNewForm, setShowNewForm] = useState(false);

  const semDisciplinas =
    disciplinas !== null && disciplinas.length === 0;

  const handleSubmit = async (
    input: TopicoInput,
    onDone: () => void
  ): Promise<void> => {
    try {
      if (editingId) {
        await updateTopico(editingId, input);
        toast('Tópico atualizado', 'success');
      } else {
        await createTopico(input);
        toast('Tópico criado', 'success');
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

  const handleDelete = async (t: Topico) => {
    const filhos = topicos?.filter(
      (x) => x.parent_topico_id === t.id && !x.deleted_at
    );
    const aviso =
      filhos && filhos.length > 0
        ? ` Isso também removerá ${filhos.length} subtópico(s) descendente(s).`
        : '';
    const ok = await confirmDialog({
      title: 'Excluir tópico',
      message: `Excluir "${t.nome}"?${aviso} Questões com topico_id apontando aqui ficarão sem tópico.`,
      danger: true,
    });
    if (!ok) return;
    try {
      await softDeleteTopico(t.id);
      toast('Tópico excluído', 'success');
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : 'Erro ao excluir', 'error');
    }
  };

  return (
    <section className="card">
      <div className="row between" style={{ marginBottom: 12 }}>
        <h2 style={{ margin: 0 }}>
          Tópicos{' '}
          {topicos ? <span className="muted">({topicos.length})</span> : null}
        </h2>
        {!showNewForm && !editingId && !semDisciplinas && (
          <button
            type="button"
            className="primary"
            onClick={() => setShowNewForm(true)}
          >
            + Novo
          </button>
        )}
      </div>

      {semDisciplinas && (
        <p className="empty">
          Crie pelo menos uma disciplina antes de adicionar tópicos.
        </p>
      )}

      {showNewForm && disciplinas && disciplinas.length > 0 && (
        <TopicoForm
          initial={EMPTY_INPUT(disciplinas[0].id)}
          submitLabel="Criar"
          disciplinas={disciplinas}
          topicos={topicos ?? []}
          editingId={null}
          onSubmit={handleSubmit}
          onCancel={() => setShowNewForm(false)}
        />
      )}

      {loading && topicos === null && (
        <p className="muted">Carregando…</p>
      )}
      {error && (
        <p className="muted" role="alert">
          Erro ao carregar: {error}
        </p>
      )}

      {topicos &&
        disciplinas &&
        topicos.length > 0 &&
        renderHierarchy({
          topicos,
          disciplinas,
          editingId,
          onEdit: (id) => setEditingId(id),
          onCancelEdit: () => setEditingId(null),
          onDelete: handleDelete,
          onSubmit: handleSubmit,
        })}

      {topicos && topicos.length === 0 && !showNewForm && !semDisciplinas && (
        <p className="empty">
          Nenhum tópico ainda. Crie pra detalhar a cobertura por disciplina.
        </p>
      )}
    </section>
  );
}

function renderHierarchy(opts: {
  topicos: Topico[];
  disciplinas: Disciplina[];
  editingId: string | null;
  onEdit: (id: string) => void;
  onCancelEdit: () => void;
  onDelete: (t: Topico) => void;
  onSubmit: (input: TopicoInput, onDone: () => void) => Promise<void>;
}) {
  const { topicos, disciplinas, editingId } = opts;

  // Agrupa tópicos por disciplina
  const byDisc = new Map<string, Topico[]>();
  for (const t of topicos) {
    const arr = byDisc.get(t.disciplina_id) ?? [];
    arr.push(t);
    byDisc.set(t.disciplina_id, arr);
  }

  const discsComTopicos = disciplinas.filter((d) => byDisc.has(d.id));

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
      }}
    >
      {discsComTopicos.map((d) => (
        <div key={d.id}>
          <h3
            className="muted"
            style={{
              margin: '0 0 8px',
              fontSize: '0.85rem',
              textTransform: 'uppercase',
              letterSpacing: 0.5,
            }}
          >
            {d.nome}
          </h3>
          <ul
            style={{
              listStyle: 'none',
              padding: 0,
              margin: 0,
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
            }}
          >
            {renderTopicoTree({
              topicos: byDisc.get(d.id) ?? [],
              disciplinas,
              parentId: null,
              depth: 0,
              editingId: opts.editingId,
              onEdit: opts.onEdit,
              onCancelEdit: opts.onCancelEdit,
              onDelete: opts.onDelete,
              onSubmit: opts.onSubmit,
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}

function renderTopicoTree(opts: {
  topicos: Topico[];
  disciplinas: Disciplina[];
  parentId: string | null;
  depth: number;
  editingId: string | null;
  onEdit: (id: string) => void;
  onCancelEdit: () => void;
  onDelete: (t: Topico) => void;
  onSubmit: (input: TopicoInput, onDone: () => void) => Promise<void>;
}): React.ReactNode[] {
  const { topicos, parentId, depth, editingId } = opts;
  const filhos = topicos
    .filter((t) => (t.parent_topico_id ?? null) === parentId)
    .sort((a, b) => a.ordem - b.ordem || a.nome.localeCompare(b.nome));

  return filhos.flatMap((t) => {
    const linha =
      editingId === t.id ? (
        <li key={t.id}>
          <TopicoForm
            initial={{
              nome: t.nome,
              disciplina_id: t.disciplina_id,
              parent_topico_id: t.parent_topico_id,
              ordem: t.ordem,
            }}
            submitLabel="Salvar"
            disciplinas={opts.disciplinas}
            topicos={topicos}
            editingId={t.id}
            onSubmit={opts.onSubmit}
            onCancel={opts.onCancelEdit}
          />
        </li>
      ) : (
        <TopicoRow
          key={t.id}
          topico={t}
          depth={depth}
          onEdit={() => opts.onEdit(t.id)}
          onDelete={() => opts.onDelete(t)}
        />
      );
    const descendentes = renderTopicoTree({ ...opts, parentId: t.id, depth: depth + 1 });
    return [linha, ...descendentes];
  });
}

function TopicoRow({
  topico,
  depth,
  onEdit,
  onDelete,
}: {
  topico: Topico;
  depth: number;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <li
      style={{
        background: 'var(--bg-elev-2)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius)',
        padding: '10px 12px',
        marginLeft: depth * 18,
      }}
    >
      <div className="row between gap wrap">
        <div style={{ minWidth: 0, flex: '1 1 auto' }}>
          <span style={{ fontWeight: 500 }}>{topico.nome}</span>
          {topico.ordem !== 0 && (
            <span
              className="muted"
              style={{ marginLeft: 8, fontSize: '0.82rem' }}
            >
              ord. {topico.ordem}
            </span>
          )}
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

function TopicoForm({
  initial,
  submitLabel,
  disciplinas,
  topicos,
  editingId,
  onSubmit,
  onCancel,
}: {
  initial: TopicoInput;
  submitLabel: string;
  disciplinas: Disciplina[];
  topicos: Topico[];
  editingId: string | null;
  onSubmit: (input: TopicoInput, onDone: () => void) => Promise<void>;
  onCancel: () => void;
}) {
  const [nome, setNome] = useState(initial.nome);
  const [discId, setDiscId] = useState(initial.disciplina_id);
  const [parentId, setParentId] = useState<string>(
    initial.parent_topico_id ?? ''
  );
  const [ordem, setOrdem] = useState(String(initial.ordem ?? 0));
  const [submitting, setSubmitting] = useState(false);

  // Possíveis pais: tópicos da mesma disciplina, exceto o próprio (e
  // descendentes, pra impedir ciclos). Calculamos descendentes via BFS.
  const possiveisPais = useMemo(() => {
    if (!editingId) {
      return topicos.filter((t) => t.disciplina_id === discId);
    }
    const proibidos = new Set<string>([editingId]);
    const fila = [editingId];
    while (fila.length > 0) {
      const cur = fila.shift()!;
      for (const t of topicos) {
        if (t.parent_topico_id === cur && !proibidos.has(t.id)) {
          proibidos.add(t.id);
          fila.push(t.id);
        }
      }
    }
    return topicos.filter(
      (t) => t.disciplina_id === discId && !proibidos.has(t.id)
    );
  }, [topicos, discId, editingId]);

  const reset = () => {
    setNome('');
    setParentId('');
    setOrdem('0');
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);

    let ordemNum = 0;
    if (ordem.trim()) {
      const n = Number(ordem);
      if (!Number.isFinite(n)) {
        toast('Ordem precisa ser número', 'error');
        setSubmitting(false);
        return;
      }
      ordemNum = Math.trunc(n);
    }

    await onSubmit(
      {
        nome,
        disciplina_id: discId,
        parent_topico_id: parentId || null,
        ordem: ordemNum,
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
            placeholder="Ex: Sintaxe — Regência verbal"
            autoFocus
          />
        </label>
        <label>
          <span>Disciplina *</span>
          <select
            value={discId}
            onChange={(e) => {
              setDiscId(e.target.value);
              setParentId(''); // muda disciplina → reseta pai
            }}
            required
            disabled={!!editingId}
            title={editingId ? 'Não dá pra mudar a disciplina depois.' : undefined}
          >
            {disciplinas.map((d) => (
              <option key={d.id} value={d.id}>
                {d.nome}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Tópico-pai (opcional)</span>
          <select
            value={parentId}
            onChange={(e) => setParentId(e.target.value)}
          >
            <option value="">— Raiz da disciplina —</option>
            {possiveisPais.map((t) => (
              <option key={t.id} value={t.id}>
                {t.nome}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Ordem</span>
          <input
            type="number"
            value={ordem}
            onChange={(e) => setOrdem(e.target.value)}
            min={0}
            max={999999}
            step={1}
          />
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
