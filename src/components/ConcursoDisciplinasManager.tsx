'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  HierarchyValidationError,
  ensureDisciplinasExist,
  linkConcursoDisciplina,
  unlinkConcursoDisciplina,
  updateConcursoDisciplina,
  useConcursoDisciplinas,
  useDisciplinas,
} from '@/lib/hierarchy';
import { selectDisciplinas, useStore } from '@/lib/store';
import type { ConcursoDisciplina, Disciplina } from '@/lib/types';
import { confirmDialog } from './ConfirmDialog';
import { toast } from './Toast';

/**
 * Gerencia os vínculos de um concurso com disciplinas (com peso e
 * qtd_questoes_prova). É expansível dentro de um card de concurso.
 *
 * UX:
 *  - Lista de vínculos atuais com peso, qtd_questoes e ações.
 *  - Picker para adicionar nova disciplina (select das ainda não vinculadas).
 *  - Edição inline de peso/qtd em cada linha.
 */
export function ConcursoDisciplinasManager({
  concursoId,
}: {
  concursoId: string;
}) {
  const { data: vinculos, loading, error } = useConcursoDisciplinas(concursoId);
  const { data: disciplinasAll } = useDisciplinas();
  // Disciplinas derivadas das questões locais — fonte de verdade do que
  // existe pra vincular (mesmo que ainda não tenha registro na tabela).
  const disciplinasNasQuestoes = useStore(selectDisciplinas);

  // Auto-cria registros na tabela `disciplinas` pra qualquer nome que
  // exista nas questões mas não tenha entry. Garante que o user sempre
  // vê todas as disciplinas existentes pra escolher — sem precisar criar
  // manualmente. Roda no mount e quando lista de disciplinas mudar.
  useEffect(() => {
    if (!disciplinasAll || disciplinasNasQuestoes.length === 0) return;
    const existentesLower = new Set(
      disciplinasAll.map((d) => d.nome.toLowerCase())
    );
    const faltantes = disciplinasNasQuestoes.filter(
      (n) => !existentesLower.has(n.toLowerCase())
    );
    if (faltantes.length === 0) return;
    void ensureDisciplinasExist(faltantes);
  }, [disciplinasAll, disciplinasNasQuestoes]);

  const disciplinasMap = useMemo(() => {
    const m = new Map<string, Disciplina>();
    for (const d of disciplinasAll ?? []) m.set(d.id, d);
    return m;
  }, [disciplinasAll]);

  // Disciplinas ainda não vinculadas a este concurso
  const disciplinasDisponiveis = useMemo(() => {
    if (!disciplinasAll) return [];
    const usadas = new Set(vinculos.map((v) => v.disciplina_id));
    return disciplinasAll.filter((d) => !usadas.has(d.id));
  }, [disciplinasAll, vinculos]);

  return (
    <div
      style={{
        marginTop: 12,
        padding: 12,
        background: 'var(--bg-elev)',
        borderRadius: 'var(--radius)',
        border: '1px dashed var(--border)',
      }}
    >
      <div className="row between" style={{ marginBottom: 8 }}>
        <strong style={{ fontSize: '0.92rem' }}>
          Disciplinas vinculadas{' '}
          <span className="muted">({vinculos.length})</span>
        </strong>
      </div>

      {error && (
        <p className="muted" role="alert" style={{ fontSize: '0.85rem' }}>
          Erro: {error}
        </p>
      )}
      {loading && vinculos.length === 0 && (
        <p className="muted" style={{ fontSize: '0.85rem' }}>
          Carregando…
        </p>
      )}

      {vinculos.length === 0 && !loading && (
        <p
          className="muted"
          style={{ fontSize: '0.88rem', fontStyle: 'italic' }}
        >
          Nenhuma disciplina vinculada. Adicione abaixo as que vão cair na
          prova — ajuda a filtrar e a montar simulados realistas.
        </p>
      )}

      {vinculos.length > 0 && (
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
          {vinculos.map((v) => (
            <VinculoRow
              key={v.id}
              vinculo={v}
              disciplina={disciplinasMap.get(v.disciplina_id) ?? null}
            />
          ))}
        </ul>
      )}

      <AdicionarVinculoForm
        concursoId={concursoId}
        disponiveis={disciplinasDisponiveis}
      />
    </div>
  );
}

function VinculoRow({
  vinculo: v,
  disciplina: d,
}: {
  vinculo: ConcursoDisciplina;
  disciplina: Disciplina | null;
}) {
  const [editing, setEditing] = useState(false);
  const [peso, setPeso] = useState(String(v.peso));
  const [qtd, setQtd] = useState(
    v.qtd_questoes_prova != null ? String(v.qtd_questoes_prova) : ''
  );
  const [submitting, setSubmitting] = useState(false);

  const handleSave = async () => {
    const pesoNum = Number(peso);
    if (!Number.isFinite(pesoNum) || pesoNum <= 0) {
      toast('Peso deve ser um número > 0', 'error');
      return;
    }
    const qtdNum = qtd.trim() === '' ? null : Number(qtd);
    if (qtdNum !== null && (!Number.isInteger(qtdNum) || qtdNum <= 0)) {
      toast('Qtd questões deve ser inteiro > 0', 'error');
      return;
    }
    setSubmitting(true);
    try {
      await updateConcursoDisciplina(v.id, {
        peso: pesoNum,
        qtd_questoes_prova: qtdNum,
      });
      toast('Atualizado', 'success');
      setEditing(false);
    } catch (e) {
      const msg =
        e instanceof HierarchyValidationError
          ? e.message
          : e instanceof Error
            ? e.message
            : 'Erro';
      toast(msg, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRemove = async () => {
    const ok = await confirmDialog({
      title: 'Remover vínculo',
      message: `Remover "${d?.nome ?? 'disciplina'}" deste concurso? Não exclui a disciplina nem as questões — só desvincula.`,
      danger: true,
    });
    if (!ok) return;
    try {
      await unlinkConcursoDisciplina(v.id);
      toast('Vínculo removido', 'success');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Erro ao remover', 'error');
    }
  };

  const nome = d?.nome ?? '(disciplina removida)';

  if (editing) {
    return (
      <li
        style={{
          background: 'var(--bg-elev-2)',
          border: '1px solid var(--primary)',
          borderRadius: 'var(--radius)',
          padding: '8px 10px',
        }}
      >
        <div className="row gap wrap" style={{ alignItems: 'center' }}>
          <strong style={{ flex: '0 0 auto' }}>{nome}</strong>
          <label style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
            <span style={{ fontSize: '0.82rem' }}>Peso</span>
            <input
              type="number"
              step="0.1"
              min="0.1"
              value={peso}
              onChange={(e) => setPeso(e.target.value)}
              style={{ width: 80 }}
            />
          </label>
          <label style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
            <span style={{ fontSize: '0.82rem' }}>Qtd na prova</span>
            <input
              type="number"
              min="1"
              value={qtd}
              onChange={(e) => setQtd(e.target.value)}
              placeholder="(opcional)"
              style={{ width: 90 }}
            />
          </label>
          <div className="row gap" style={{ marginLeft: 'auto' }}>
            <button
              type="button"
              className="ghost"
              onClick={() => setEditing(false)}
              disabled={submitting}
            >
              Cancelar
            </button>
            <button
              type="button"
              className="primary"
              onClick={handleSave}
              disabled={submitting}
            >
              {submitting ? 'Salvando…' : 'Salvar'}
            </button>
          </div>
        </div>
      </li>
    );
  }

  return (
    <li
      style={{
        background: 'var(--bg-elev-2)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius)',
        padding: '8px 10px',
      }}
    >
      <div className="row between gap wrap" style={{ alignItems: 'center' }}>
        <div className="row gap" style={{ alignItems: 'center', minWidth: 0 }}>
          {d?.cor && (
            <span
              aria-hidden
              style={{
                width: 10,
                height: 10,
                borderRadius: 3,
                background: d.cor,
                border: '1px solid var(--border)',
                flexShrink: 0,
              }}
            />
          )}
          <span style={{ fontWeight: 500 }}>{nome}</span>
          <span className="muted" style={{ fontSize: '0.85rem' }}>
            peso {v.peso}
            {v.qtd_questoes_prova != null && ` · ${v.qtd_questoes_prova} questão(ões) na prova`}
          </span>
        </div>
        <div className="row gap">
          <button
            type="button"
            className="ghost"
            onClick={() => setEditing(true)}
          >
            Editar
          </button>
          <button type="button" className="danger" onClick={handleRemove}>
            Remover
          </button>
        </div>
      </div>
    </li>
  );
}

function AdicionarVinculoForm({
  concursoId,
  disponiveis,
}: {
  concursoId: string;
  disponiveis: Disciplina[];
}) {
  const [discId, setDiscId] = useState<string>('');
  const [peso, setPeso] = useState('1');
  const [qtd, setQtd] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!discId) {
      toast('Escolha uma disciplina', 'error');
      return;
    }
    const pesoNum = Number(peso);
    if (!Number.isFinite(pesoNum) || pesoNum <= 0) {
      toast('Peso deve ser um número > 0', 'error');
      return;
    }
    const qtdNum = qtd.trim() === '' ? null : Number(qtd);
    if (qtdNum !== null && (!Number.isInteger(qtdNum) || qtdNum <= 0)) {
      toast('Qtd questões deve ser inteiro > 0', 'error');
      return;
    }
    setSubmitting(true);
    try {
      await linkConcursoDisciplina({
        concurso_id: concursoId,
        disciplina_id: discId,
        peso: pesoNum,
        qtd_questoes_prova: qtdNum,
      });
      toast('Disciplina vinculada', 'success');
      setDiscId('');
      setPeso('1');
      setQtd('');
    } catch (err) {
      const msg =
        err instanceof HierarchyValidationError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Erro';
      toast(msg, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  if (disponiveis.length === 0) {
    return (
      <p
        className="muted"
        style={{
          fontSize: '0.82rem',
          marginTop: 10,
          fontStyle: 'italic',
        }}
      >
        Todas as disciplinas existentes já estão vinculadas. Disciplinas
        novas aparecem automaticamente quando você importa questões com
        novos valores em <code>disciplina_id</code>.
      </p>
    );
  }

  return (
    <form
      onSubmit={handleAdd}
      style={{
        marginTop: 10,
        padding: 10,
        background: 'var(--bg-elev-2)',
        borderRadius: 'var(--radius)',
        border: '1px solid var(--border)',
      }}
    >
      <div className="row gap wrap" style={{ alignItems: 'center' }}>
        <select
          value={discId}
          onChange={(e) => setDiscId(e.target.value)}
          style={{ flex: '1 1 200px' }}
        >
          <option value="">— escolher disciplina —</option>
          {disponiveis.map((d) => (
            <option key={d.id} value={d.id}>
              {d.nome}
            </option>
          ))}
        </select>
        <label style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          <span style={{ fontSize: '0.82rem' }}>Peso</span>
          <input
            type="number"
            step="0.1"
            min="0.1"
            value={peso}
            onChange={(e) => setPeso(e.target.value)}
            style={{ width: 70 }}
          />
        </label>
        <label style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          <span style={{ fontSize: '0.82rem' }}>Qtd na prova</span>
          <input
            type="number"
            min="1"
            value={qtd}
            onChange={(e) => setQtd(e.target.value)}
            placeholder="(opcional)"
            style={{ width: 90 }}
          />
        </label>
        <button
          type="submit"
          className="primary"
          disabled={submitting || !discId}
        >
          {submitting ? 'Adicionando…' : '+ Vincular'}
        </button>
      </div>
    </form>
  );
}
