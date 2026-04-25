'use client';

import { useMemo, useState } from 'react';
import {
  useStore,
  selectActiveQuestions,
  selectDisciplinas,
  deleteQuestionsBulk,
} from '@/lib/store';
import { scheduleSync } from '@/lib/sync';
import { fmtRelative } from '@/lib/format';
import { confirmDialog } from './ConfirmDialog';
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

  const [search, setSearch] = useState('');
  const [disc, setDisc] = useState('');
  const [tipo, setTipo] = useState<'' | 'objetiva' | 'discursiva'>('');
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const filtered = useMemo(() => {
    const txt = search.trim().toLowerCase();
    return questions.filter((q) => {
      if (disc && q.disciplina_id !== disc) return false;
      if (tipo && q.type !== tipo) return false;
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
  }, [questions, search, disc, tipo]);

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
      </div>

      <div className="row gap wrap" style={{ marginBottom: 12 }}>
        <button type="button" onClick={selectAllFiltered}>
          Selecionar tudo (filtrado)
        </button>
        <button type="button" onClick={() => setSelected(new Set())}>
          Limpar seleção
        </button>
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

      <div className="banco-list">
        {filtered.length === 0 ? (
          <div className="empty">
            <div className="big">∅</div>
            <p>
              {questions.length === 0
                ? 'Nenhuma questão. Importe um JSON acima para começar.'
                : 'Nenhuma questão corresponde aos filtros.'}
            </p>
          </div>
        ) : (
          filtered.map((q) => {
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
                    {q.disciplina_id && <span>{q.disciplina_id}</span>}
                    {q.tema && <span>{q.tema}</span>}
                    <span>{q.type}</span>
                    {q.banca_estilo && <span>{q.banca_estilo}</span>}
                    {q.dificuldade != null && <span>dif {q.dificuldade}</span>}
                    {q.srs?.dueDate && <span title="Próxima revisão">↻ {fmtRelative(q.srs.dueDate)}</span>}
                  </div>
                </div>
                <div className="actions">
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
    </div>
  );
}
