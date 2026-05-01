'use client';

import { useMemo, useRef, useState } from 'react';
import { useStore, addQuestionsBulk, selectActiveQuestions } from '@/lib/store';
import { scheduleSync } from '@/lib/sync';
import {
  dedupeKey,
  extractItems,
  normalizeQuestion,
  safeParseJSON,
  validateQuestion,
} from '@/lib/validation';
import { useConcursos, useDisciplinas, useTopicos } from '@/lib/hierarchy';
import { toast } from './Toast';

type ImportResult = { added: number; skipped: number; errors: string[] };

type AssignOpts = {
  concursoId: string | null;
  topicoId: string | null;
  /** Nome da disciplina derivado do tópico — sobrescreve disciplina_id (string). */
  discNome: string | null;
};

export function ImportZone() {
  const userId = useStore((s) => s.userId);
  const existing = useStore(selectActiveQuestions);
  const { data: concursos } = useConcursos();
  const { data: disciplinas } = useDisciplinas();
  const { data: topicos } = useTopicos();

  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [paste, setPaste] = useState('');
  const [report, setReport] = useState<ImportResult | null>(null);

  // Atribuição opcional aplicada a TODAS as questões do lote
  const [assignConcursoId, setAssignConcursoId] = useState('');
  const [assignDiscId, setAssignDiscId] = useState('');
  const [assignTopicoId, setAssignTopicoId] = useState('');

  const topicosFiltrados = useMemo(
    () =>
      (topicos ?? [])
        .filter((t) => !assignDiscId || t.disciplina_id === assignDiscId)
        .filter((t) => !t.deleted_at),
    [topicos, assignDiscId]
  );

  const buildAssign = (): AssignOpts => {
    const tid = assignTopicoId || null;
    const cid = assignConcursoId || null;
    let discNome: string | null = null;
    if (tid) {
      const t = topicos?.find((x) => x.id === tid);
      const d = t && disciplinas?.find((x) => x.id === t.disciplina_id);
      discNome = d?.nome ?? null;
    } else if (assignDiscId) {
      const d = disciplinas?.find((x) => x.id === assignDiscId);
      discNome = d?.nome ?? null;
    }
    return { concursoId: cid, topicoId: tid, discNome };
  };

  const importText = (text: string): ImportResult => {
    if (!userId) return { added: 0, skipped: 0, errors: ['Sem usuário autenticado'] };
    if (!text || !text.trim()) return { added: 0, skipped: 0, errors: ['Vazio.'] };
    const { value, error } = safeParseJSON(text);
    if (error) return { added: 0, skipped: 0, errors: ['JSON inválido: ' + error] };
    const items = extractItems(value);
    if (items.length === 0) return { added: 0, skipped: 0, errors: ['Nenhum item encontrado.'] };

    const assign = buildAssign();
    const existingKeys = new Set(existing.map(dedupeKey));
    const novos: Parameters<typeof addQuestionsBulk>[0] = [];
    const errors: string[] = [];
    let skipped = 0;

    items.forEach((raw, idx) => {
      const v = validateQuestion(raw);
      if (!v.ok) {
        errors.push(`Item #${idx + 1}: ${v.errors.join(' | ')}`);
        return;
      }
      const baseNorm = normalizeQuestion(raw as Record<string, unknown>, v.type);
      // Aplica atribuição em lote (vinda dos selects acima do dropzone).
      // discNome sobrescreve disciplina_id da questão pra coerência com
      // o filtro string atual de /banco — só se houve override explícito.
      const norm: typeof baseNorm = {
        ...baseNorm,
        topico_id: assign.topicoId,
        concurso_id: assign.concursoId,
        disciplina_id: assign.discNome ?? baseNorm.disciplina_id,
      };
      const key = dedupeKey(norm);
      if (existingKeys.has(key)) {
        skipped++;
        return;
      }
      existingKeys.add(key);
      novos.push(norm);
    });

    if (novos.length) {
      addQuestionsBulk(novos, userId);
      scheduleSync(800);
    }
    return { added: novos.length, skipped, errors };
  };

  const handleFiles = async (files: FileList | File[]) => {
    const arr = Array.from(files).filter(
      (f) => f.name.toLowerCase().endsWith('.json') || /json/i.test(f.type)
    );
    if (!arr.length) {
      toast('Nenhum arquivo JSON.', 'warn');
      return;
    }
    const aggregate: ImportResult = { added: 0, skipped: 0, errors: [] };
    for (const file of arr) {
      try {
        const text = await file.text();
        const r = importText(text);
        aggregate.added += r.added;
        aggregate.skipped += r.skipped;
        aggregate.errors.push(...r.errors.map((e) => `[${file.name}] ${e}`));
      } catch (e) {
        aggregate.errors.push(
          `[${file.name}] Falha ao ler: ${e instanceof Error ? e.message : String(e)}`
        );
      }
    }
    setReport(aggregate);
    if (aggregate.added > 0) toast(`${aggregate.added} questão(ões) importada(s).`, 'success');
    else if (aggregate.errors.length) toast('Importação falhou. Veja relatório.', 'error');
  };

  const handlePaste = () => {
    const r = importText(paste);
    setReport(r);
    if (r.added > 0) {
      toast(`${r.added} questão(ões) importada(s).`, 'success');
      setPaste('');
    } else if (r.errors.length) {
      toast('Importação falhou. Veja relatório.', 'error');
    }
  };

  const temHierarquia =
    (concursos?.length ?? 0) > 0 ||
    (disciplinas?.length ?? 0) > 0 ||
    (topicos?.length ?? 0) > 0;

  return (
    <div className="card">
      <h2>Importar questões</h2>
      <p className="muted">
        Aceita um único objeto, um array, ou um objeto com a chave <code>questions</code>. Suporta
        objetivas e discursivas (campo <code>tipo: &quot;discursiva&quot;</code>).
      </p>

      {temHierarquia && (
        <details
          style={{
            marginBottom: 12,
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
            padding: '8px 12px',
            background: 'var(--bg-elev-2)',
          }}
        >
          <summary style={{ cursor: 'pointer', fontWeight: 500 }}>
            Atribuir ao lote (opcional)
            {(assignConcursoId || assignTopicoId || assignDiscId) && (
              <span className="muted" style={{ marginLeft: 8, fontSize: '0.85rem' }}>
                — ativo
              </span>
            )}
          </summary>
          <div className="row gap wrap" style={{ marginTop: 10 }}>
            {(concursos?.length ?? 0) > 0 && (
              <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span className="muted" style={{ fontSize: '0.82rem' }}>
                  Concurso
                </span>
                <select
                  value={assignConcursoId}
                  onChange={(e) => setAssignConcursoId(e.target.value)}
                  style={{ minWidth: 200 }}
                >
                  <option value="">— Nenhum —</option>
                  {concursos?.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nome}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {(disciplinas?.length ?? 0) > 0 && (
              <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span className="muted" style={{ fontSize: '0.82rem' }}>
                  Disciplina
                </span>
                <select
                  value={assignDiscId}
                  onChange={(e) => {
                    setAssignDiscId(e.target.value);
                    setAssignTopicoId('');
                  }}
                  style={{ minWidth: 200 }}
                >
                  <option value="">— Manter do JSON —</option>
                  {disciplinas?.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.nome}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {(topicos?.length ?? 0) > 0 && (
              <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span className="muted" style={{ fontSize: '0.82rem' }}>
                  Tópico
                </span>
                <select
                  value={assignTopicoId}
                  onChange={(e) => setAssignTopicoId(e.target.value)}
                  style={{ minWidth: 240 }}
                >
                  <option value="">— Nenhum —</option>
                  {topicosFiltrados.map((t) => {
                    const d = disciplinas?.find((x) => x.id === t.disciplina_id);
                    const prefix = d && !assignDiscId ? `${d.nome} · ` : '';
                    return (
                      <option key={t.id} value={t.id}>
                        {prefix}
                        {t.nome}
                      </option>
                    );
                  })}
                </select>
              </label>
            )}
          </div>
          {(assignConcursoId || assignTopicoId || assignDiscId) && (
            <button
              type="button"
              className="ghost"
              style={{ marginTop: 10 }}
              onClick={() => {
                setAssignConcursoId('');
                setAssignDiscId('');
                setAssignTopicoId('');
              }}
            >
              Limpar atribuição
            </button>
          )}
        </details>
      )}

      <div
        className={'dropzone' + (dragOver ? ' dragover' : '')}
        tabIndex={0}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        onDragEnter={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (e.dataTransfer?.files?.length) void handleFiles(e.dataTransfer.files);
        }}
      >
        <span className="icon" aria-hidden>
          ⬆
        </span>
        <strong>Arraste arquivos JSON aqui</strong>
        <span>ou clique para selecionar</span>
        <input
          ref={inputRef}
          type="file"
          accept=".json,application/json"
          multiple
          hidden
          onChange={(e) => {
            if (e.target.files?.length) void handleFiles(e.target.files);
            e.target.value = '';
          }}
        />
      </div>

      <details className="paste-block">
        <summary>Colar JSON manualmente</summary>
        <textarea
          rows={10}
          value={paste}
          onChange={(e) => setPaste(e.target.value)}
          placeholder='Cole aqui o JSON. Ex.: [{"disciplina_id":"...","enunciado":"...","alternativas":[...]}, ...]'
        />
        <div className="row gap">
          <button type="button" className="primary" onClick={handlePaste}>
            Importar JSON colado
          </button>
          <button type="button" onClick={() => setPaste('')}>
            Limpar
          </button>
        </div>
      </details>

      {report && (
        <div
          className={
            'import-report ' +
            (report.added > 0 && report.errors.length === 0
              ? 'ok'
              : report.errors.length
                ? 'fail'
                : '')
          }
        >
          <strong>{report.added}</strong> adicionada(s)
          {report.skipped > 0 && <> · <strong>{report.skipped}</strong> duplicada(s) ignorada(s)</>}
          {report.errors.length > 0 && (
            <details open>
              <summary>
                <strong>{report.errors.length}</strong> erro(s)
              </summary>
              <ul>
                {report.errors.slice(0, 50).map((e, i) => (
                  <li key={i}>{e}</li>
                ))}
                {report.errors.length > 50 && <li>… e {report.errors.length - 50} a mais</li>}
              </ul>
            </details>
          )}
        </div>
      )}
    </div>
  );
}
