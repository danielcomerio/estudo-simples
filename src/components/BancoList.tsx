'use client';

import { useMemo, useState } from 'react';
import {
  useStore,
  selectActiveQuestions,
  selectDisciplinas,
  deleteQuestionsBulk,
  updateQuestionLocal,
} from '@/lib/store';
import { scheduleSync } from '@/lib/sync';
import { fmtRelative } from '@/lib/format';
import {
  matchActiveConcurso,
  useActiveConcursoFilter,
  useDisciplinas,
  useTopicos,
} from '@/lib/hierarchy';
import { setActiveConcursoId } from '@/lib/settings';
import { confirmDialog } from './ConfirmDialog';
import { QuestionEditDrawer } from './QuestionEditDrawer';
import { toast } from './Toast';
import type { ObjetivaPayload, DiscursivaPayload, Question } from '@/lib/types';

function previewOf(q: Question): string {
  if (q.type === 'objetiva') return (q.payload as ObjetivaPayload).enunciado || '';
  const p = q.payload as DiscursivaPayload;
  return p.enunciado_completo || p.enunciado || p.comando || '';
}

export function BancoList() {
  const questions = useStore(selectActiveQuestions);
  const disciplinas = useStore(selectDisciplinas);
  const hydrated = useStore((s) => s.hydrated);
  const syncStatus = useStore((s) => s.syncStatus);
  const lastPullAt = useStore((s) => s.lastPullAt);
  const firstSyncInFlight = syncStatus === 'syncing' && !lastPullAt;

  const [search, setSearch] = useState('');
  const [disc, setDisc] = useState('');
  const [tipo, setTipo] = useState<'' | 'objetiva' | 'discursiva'>('');
  const [origem, setOrigem] = useState<'' | 'real' | 'autoral' | 'adaptada'>('');
  const [verif, setVerif] = useState<'' | 'verificada' | 'pendente' | 'duvidosa' | 'sem_verif'>('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  // Paginação visual: render só os primeiros N pra evitar travar com
  // milhares de cards. User pode "carregar mais" pra estender.
  const PAGE_SIZE = 100;
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [editingId, setEditingId] = useState<string | null>(null);
  const editingQuestion = useMemo(
    () => (editingId ? questions.find((q) => q.id === editingId) ?? null : null),
    [questions, editingId]
  );

  const { concurso: activeConcurso, disciplinaNomes: concursoDiscNomes } =
    useActiveConcursoFilter();

  // Reset paginação quando filtros mudam
  const filtersKey = `${search}|${disc}|${tipo}|${origem}|${verif}`;
  useMemo(() => {
    setVisibleCount(PAGE_SIZE);
  }, [filtersKey]);

  const filtered = useMemo(() => {
    const txt = search.trim().toLowerCase();
    return questions.filter((q) => {
      if (!matchActiveConcurso(q.disciplina_id, concursoDiscNomes)) return false;
      if (disc && q.disciplina_id !== disc) return false;
      if (tipo && q.type !== tipo) return false;
      if (origem) {
        // 'autoral' inclui legado (sem campo origem) — questões pré-migration
        // 0003 foram todas criadas pelo user, então conceitualmente autorais.
        if (origem === 'autoral') {
          if (q.origem && q.origem !== 'autoral') return false;
        } else {
          if (q.origem !== origem) return false;
        }
      }
      if (verif) {
        if (verif === 'sem_verif') {
          if (q.verificacao) return false;
        } else {
          if (q.verificacao !== verif) return false;
        }
      }
      if (txt) {
        const hay = [
          q.tema,
          q.disciplina_id,
          q.banca_estilo,
          previewOf(q),
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        if (!hay.includes(txt)) return false;
      }
      return true;
    });
  }, [questions, search, disc, tipo, origem, verif, concursoDiscNomes]);

  const toggle = (id: string) => {
    setSelected((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAllFiltered = () => {
    setSelected((cur) => {
      const next = new Set(cur);
      for (const q of filtered) next.add(q.id);
      return next;
    });
  };

  const deleteOne = async (id: string) => {
    const ok = await confirmDialog({
      title: 'Excluir questão',
      message: 'Esta ação remove a questão do banco. Continuar?',
      danger: true,
    });
    if (!ok) return;
    deleteQuestionsBulk([id]);
    setSelected((cur) => {
      const next = new Set(cur);
      next.delete(id);
      return next;
    });
    scheduleSync(500);
    toast('Questão excluída.', 'success');
  };

  const deleteSelected = async () => {
    if (selected.size === 0) {
      toast('Nada selecionado.', 'warn');
      return;
    }
    const ok = await confirmDialog({
      title: 'Excluir selecionadas',
      message: `Remover ${selected.size} questão(ões) selecionada(s)?`,
      danger: true,
    });
    if (!ok) return;
    deleteQuestionsBulk(Array.from(selected));
    setSelected(new Set());
    scheduleSync(500);
    toast('Selecionadas excluídas.', 'success');
  };

  const deleteAllFiltered = async () => {
    if (filtered.length === 0) {
      toast('Filtro vazio.', 'warn');
      return;
    }
    const ok = await confirmDialog({
      title: 'Excluir TUDO no filtro',
      message: `Esta ação removerá ${filtered.length} questão(ões) que correspondem ao filtro atual. Continuar?`,
      danger: true,
    });
    if (!ok) return;
    deleteQuestionsBulk(filtered.map((q) => q.id));
    setSelected(new Set());
    scheduleSync(500);
    toast(`${filtered.length} excluída(s).`, 'success');
  };

  const exportJSON = () => {
    const data = JSON.stringify(
      questions.map((q) => {
        return {
          ...q.payload,
          disciplina_id: q.disciplina_id,
          tema: q.tema,
          banca_estilo: q.banca_estilo,
          dificuldade: q.dificuldade,
          _meta: {
            id: q.id,
            type: q.type,
            srs: q.srs,
            stats: q.stats,
            created_at: q.created_at,
            updated_at: q.updated_at,
          },
        };
      }),
      null,
      2
    );
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `estudo-simples-export-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast('Backup exportado.', 'success');
  };

  return (
    <div className="card">
      {activeConcurso && (
        <div
          role="status"
          style={{
            background: 'var(--primary-soft)',
            border: '1px solid var(--primary)',
            borderRadius: 'var(--radius)',
            padding: '8px 12px',
            marginBottom: 12,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 12,
            flexWrap: 'wrap',
          }}
        >
          <span style={{ fontSize: '0.9rem' }}>
            🎯 Filtrando por concurso <strong>{activeConcurso.nome}</strong>
            {concursoDiscNomes && concursoDiscNomes.length > 0
              ? ` · ${concursoDiscNomes.length} disciplina(s) vinculada(s)`
              : ' · sem disciplinas vinculadas (vai mostrar 0 questões)'}
          </span>
          <button
            type="button"
            className="ghost"
            onClick={() => setActiveConcursoId(null)}
            style={{ fontSize: '0.85rem' }}
          >
            Ver tudo
          </button>
        </div>
      )}

      <div className="row gap wrap" style={{ marginBottom: 14 }}>
        <h2 style={{ margin: 0, marginRight: 'auto' }}>Banco atual</h2>
        <input
          type="search"
          placeholder="Buscar por tema/enunciado…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ maxWidth: 280 }}
        />
        <select value={disc} onChange={(e) => setDisc(e.target.value)}>
          <option value="">Todas as disciplinas</option>
          {disciplinas.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
        <select
          value={tipo}
          onChange={(e) => setTipo(e.target.value as typeof tipo)}
        >
          <option value="">Todos os tipos</option>
          <option value="objetiva">Objetivas</option>
          <option value="discursiva">Discursivas</option>
        </select>
        <select
          value={origem}
          onChange={(e) => setOrigem(e.target.value as typeof origem)}
          title="Filtrar por origem"
        >
          <option value="">Toda origem</option>
          <option value="real">📋 Reais</option>
          <option value="autoral">✏️ Autorais</option>
        </select>
        <select
          value={verif}
          onChange={(e) => setVerif(e.target.value as typeof verif)}
          title="Filtrar por verificação"
        >
          <option value="">Toda verificação</option>
          <option value="verificada">✅ Verificadas</option>
          <option value="pendente">⏳ Pendentes</option>
          <option value="duvidosa">⚠️ Duvidosas</option>
          <option value="sem_verif">— Sem status</option>
        </select>
      </div>

      <div className="row gap wrap" style={{ marginBottom: 12 }}>
        <button type="button" onClick={selectAllFiltered}>
          Selecionar tudo (filtrado)
        </button>
        <button type="button" onClick={() => setSelected(new Set())}>
          Limpar seleção
        </button>
        <BulkAssignTopico
          selectedIds={selected}
          onApplied={() => setSelected(new Set())}
        />
        <button type="button" className="danger" onClick={deleteSelected}>
          Excluir selecionadas
        </button>
        <button type="button" className="danger" onClick={deleteAllFiltered}>
          Excluir TUDO no filtro
        </button>
        <button type="button" onClick={exportJSON} disabled={questions.length === 0}>
          Exportar JSON
        </button>
      </div>

      {editingQuestion && (
        <QuestionEditDrawer
          question={editingQuestion}
          onClose={() => setEditingId(null)}
        />
      )}

      <div className="banco-list">
        {!hydrated || firstSyncInFlight ? (
          <div className="empty">
            <div className="skeleton" style={{ height: 60, marginBottom: 8 }} />
            <div className="skeleton" style={{ height: 60, marginBottom: 8 }} />
            <div className="skeleton" style={{ height: 60 }} />
            <p className="muted" style={{ marginTop: 14 }}>Carregando suas questões…</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="empty">
            <div className="big">∅</div>
            <p>
              {questions.length === 0
                ? 'Nenhuma questão. Importe um JSON acima para começar.'
                : 'Nenhuma questão corresponde aos filtros.'}
            </p>
          </div>
        ) : (
          filtered.slice(0, visibleCount).map((q) => {
            const enun = previewOf(q);
            return (
              <div key={q.id} className="banco-item">
                <input
                  type="checkbox"
                  checked={selected.has(q.id)}
                  onChange={() => toggle(q.id)}
                  aria-label="Selecionar"
                />
                <div>
                  <div className="preview">{enun.slice(0, 240)}{enun.length > 240 ? '…' : ''}</div>
                  <div className="meta">
                    {q.origem === 'real' && (
                      <span
                        title={`Questão real: ${q.fonte?.banca ?? '?'} ${q.fonte?.ano ?? ''} ${q.fonte?.orgao ?? ''}`}
                        style={{ background: 'var(--primary-soft)', color: 'var(--primary)', padding: '1px 6px', borderRadius: 4, fontWeight: 500 }}
                      >
                        📋 {q.fonte?.banca ?? 'real'}
                        {q.fonte?.ano ? ` ${q.fonte.ano}` : ''}
                        {q.fonte?.orgao ? ` · ${q.fonte.orgao}` : ''}
                      </span>
                    )}
                    {q.origem === 'autoral' && (
                      <span title="Autoral" style={{ opacity: 0.7 }}>✏️ autoral</span>
                    )}
                    {q.origem === 'adaptada' && (
                      <span title="Adaptada" style={{ opacity: 0.7 }}>🔧 adaptada</span>
                    )}
                    {q.verificacao === 'verificada' && (
                      <span title="Verificada">✅</span>
                    )}
                    {q.verificacao === 'pendente' && (
                      <span title="Pendente de revisão" style={{ color: 'var(--warn, #d97706)' }}>⏳</span>
                    )}
                    {q.verificacao === 'duvidosa' && (
                      <span title="Marcada como duvidosa (revisar antes de estudar)" style={{ color: 'var(--danger)' }}>⚠️</span>
                    )}
                    {q.disciplina_id && <span>{q.disciplina_id}</span>}
                    {q.tema && <span>{q.tema}</span>}
                    <span>{q.type}</span>
                    {q.banca_estilo && !q.origem && <span>{q.banca_estilo}</span>}
                    {q.dificuldade != null && <span>dif {q.dificuldade}</span>}
                    {q.payload.notes_user && (
                      <span title="Tem anotações pessoais" aria-label="Tem anotações">
                        📝
                      </span>
                    )}
                    {q.tags && q.tags.length > 0 && (
                      <span title={q.tags.join(', ')}>
                        🏷 {q.tags.length}
                      </span>
                    )}
                    {q.srs?.dueDate && <span title="Próxima revisão">↻ {fmtRelative(q.srs.dueDate)}</span>}
                  </div>
                </div>
                <div className="actions row gap">
                  <button
                    type="button"
                    className="ghost"
                    onClick={() => setEditingId(q.id)}
                    aria-label="Editar"
                    title="Editar"
                  >
                    ✎
                  </button>
                  <button
                    type="button"
                    className="danger"
                    onClick={() => deleteOne(q.id)}
                    aria-label="Excluir"
                    title="Excluir"
                  >
                    ✕
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {filtered.length > visibleCount && (
        <div
          className="row gap"
          style={{
            justifyContent: 'center',
            alignItems: 'center',
            marginTop: 12,
            padding: 12,
            background: 'var(--bg-elev-2)',
            borderRadius: 'var(--radius)',
          }}
        >
          <span className="muted" style={{ fontSize: '0.88rem' }}>
            Mostrando {visibleCount} de {filtered.length} questão(ões)
          </span>
          <button
            type="button"
            className="ghost"
            onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
          >
            Carregar mais {Math.min(PAGE_SIZE, filtered.length - visibleCount)}
          </button>
          <button
            type="button"
            className="ghost"
            onClick={() => setVisibleCount(filtered.length)}
            title="Pode travar a página com muitas"
          >
            Ver tudo
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * Bulk-assign de tópico a um conjunto de questões selecionadas.
 *
 * Comportamento:
 *  - Botão fica desabilitado se não há seleção.
 *  - Ao abrir, mostra select de disciplina (dos topicos cadastrados)
 *    e select de tópico (filtrado pela disciplina).
 *  - Confirma: itera sobre selectedIds, chama updateQuestionLocal
 *    com `{ topico_id }` (e `disciplina_id` derivado do tópico, pra
 *    manter compat com filtro string atual). Pendente é marcado pelo
 *    store; o sync push manda em chunks de 100.
 *  - Permite "remover tópico" (topico_id = null) via opção dedicada.
 */
function BulkAssignTopico({
  selectedIds,
  onApplied,
}: {
  selectedIds: Set<string>;
  onApplied: () => void;
}) {
  const { data: topicos } = useTopicos();
  const { data: disciplinas } = useDisciplinas();
  const [open, setOpen] = useState(false);
  const [discId, setDiscId] = useState('');
  const [topicoId, setTopicoId] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const disabled = selectedIds.size === 0;
  const topicosFiltrados = useMemo(
    () =>
      (topicos ?? [])
        .filter((t) => !discId || t.disciplina_id === discId)
        .filter((t) => !t.deleted_at),
    [topicos, discId]
  );

  const apply = async (mode: 'set' | 'clear') => {
    if (submitting) return;
    if (mode === 'set' && !topicoId) {
      toast('Escolha um tópico', 'warn');
      return;
    }
    setSubmitting(true);

    let novoTopicoId: string | null = null;
    let novaDiscId: string | null = null;
    if (mode === 'set') {
      const t = topicos?.find((x) => x.id === topicoId);
      if (!t) {
        toast('Tópico inválido', 'error');
        setSubmitting(false);
        return;
      }
      const d = disciplinas?.find((x) => x.id === t.disciplina_id);
      novoTopicoId = t.id;
      // Sincroniza disciplina_id (string) com nome da disciplina, pra
      // manter o filtro existente coerente com a hierarquia nova.
      novaDiscId = d?.nome ?? null;
    }

    const ids = Array.from(selectedIds);
    for (const id of ids) {
      updateQuestionLocal(id, (q) => {
        const patch: Partial<typeof q> = { topico_id: novoTopicoId };
        // Só sobrescreve disciplina_id se estamos atribuindo (mode=set)
        // e a questão estava sem disciplina ou tinha string diferente.
        if (mode === 'set' && novaDiscId) {
          patch.disciplina_id = novaDiscId;
        }
        return patch;
      });
    }
    scheduleSync(500);

    toast(
      mode === 'set'
        ? `Tópico atribuído a ${ids.length} questão(ões)`
        : `Tópico removido de ${ids.length} questão(ões)`,
      'success'
    );
    setOpen(false);
    setTopicoId('');
    setDiscId('');
    onApplied();
    setSubmitting(false);
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={disabled}
        title={
          disabled
            ? 'Selecione questões pra atribuir tópico'
            : `Atribuir tópico a ${selectedIds.size} questão(ões)`
        }
      >
        Atribuir tópico…
      </button>
    );
  }

  const semHierarquia =
    (disciplinas?.length ?? 0) === 0 || (topicos?.length ?? 0) === 0;

  return (
    <div
      className="row gap wrap"
      style={{
        background: 'var(--bg-elev-2)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius)',
        padding: 10,
        flexBasis: '100%',
      }}
    >
      {semHierarquia ? (
        <span className="muted">
          Crie disciplinas e tópicos em Configurações antes de atribuir.
        </span>
      ) : (
        <>
          <select
            value={discId}
            onChange={(e) => {
              setDiscId(e.target.value);
              setTopicoId('');
            }}
            style={{ maxWidth: 220 }}
          >
            <option value="">Todas as disciplinas</option>
            {disciplinas?.map((d) => (
              <option key={d.id} value={d.id}>
                {d.nome}
              </option>
            ))}
          </select>
          <select
            value={topicoId}
            onChange={(e) => setTopicoId(e.target.value)}
            style={{ maxWidth: 280 }}
          >
            <option value="">— Selecionar tópico —</option>
            {topicosFiltrados.map((t) => {
              const d = disciplinas?.find((x) => x.id === t.disciplina_id);
              const prefix = d && !discId ? `${d.nome} · ` : '';
              return (
                <option key={t.id} value={t.id}>
                  {prefix}
                  {t.nome}
                </option>
              );
            })}
          </select>
          <button
            type="button"
            className="primary"
            onClick={() => apply('set')}
            disabled={submitting || !topicoId}
          >
            Atribuir
          </button>
          <button
            type="button"
            onClick={() => apply('clear')}
            disabled={submitting}
            title="Remover tópico das questões selecionadas"
          >
            Remover tópico
          </button>
        </>
      )}
      <button
        type="button"
        className="ghost"
        onClick={() => {
          setOpen(false);
          setTopicoId('');
          setDiscId('');
        }}
      >
        Fechar
      </button>
    </div>
  );
}
