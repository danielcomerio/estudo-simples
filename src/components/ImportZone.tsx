'use client';

import { useMemo, useRef, useState } from 'react';
import { useStore, addQuestionsBulk, selectActiveQuestions } from '@/lib/store';
import { scheduleSync } from '@/lib/sync';
import {
  ensureDisciplinasExist,
  useConcursos,
  useDisciplinas,
  useTopicos,
} from '@/lib/hierarchy';
import {
  applyDisciplinaMapping,
  parseImportBatch,
  parseImportBatchMulti,
  suggestDisciplinaMapping,
  type BatchParseResult,
  type NormalizedItem,
} from '@/lib/real-import';
import { toast } from './Toast';

/**
 * Importação de JSON com suporte a 2 formatos:
 *  - Autoral (nosso): tem disciplina_id snake_case
 *  - Real (QConcursos-like): tem materia + concursoAno
 *
 * Fluxo:
 *  1. User dropa arquivo / cola JSON
 *  2. App parseia tudo (parseImportBatch) — NÃO grava nada
 *  3. Mostra Preview com counts + descartadas + mapping de disciplinas novas
 *  4. User confirma mapping (ou aceita sugestões automáticas)
 *  5. Botão "Importar" aplica mapping → addQuestionsBulk + ensureDisciplinasExist
 *
 * Atribuição em lote (concurso/topico/disciplina) ainda existe e é
 * aplicada após o mapping (sobrescreve disciplina_id se houver).
 */
export function ImportZone() {
  const userId = useStore((s) => s.userId);
  const existing = useStore(selectActiveQuestions);
  const { data: concursos } = useConcursos();
  const { data: disciplinas } = useDisciplinas();
  const { data: topicos } = useTopicos();

  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [paste, setPaste] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Atribuição em lote
  const [assignConcursoId, setAssignConcursoId] = useState('');
  const [assignDiscId, setAssignDiscId] = useState('');
  const [assignTopicoId, setAssignTopicoId] = useState('');

  // Preview state — itens parseados aguardando confirmação
  const [preview, setPreview] = useState<BatchParseResult | null>(null);
  // Mapping nome novo → nome existente (ou ele mesmo = manter)
  const [discMapping, setDiscMapping] = useState<Map<string, string>>(new Map());

  const topicosFiltrados = useMemo(
    () =>
      (topicos ?? [])
        .filter((t) => !assignDiscId || t.disciplina_id === assignDiscId)
        .filter((t) => !t.deleted_at),
    [topicos, assignDiscId]
  );

  const buildAssign = () => {
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

  const setupPreview = (
    runParse: () => ReturnType<typeof parseImportBatch>
  ) => {
    setError(null);
    setPreview(null);
    setDiscMapping(new Map());

    if (!userId) {
      setError('Sem usuário autenticado.');
      return;
    }

    const result = runParse();
    if (result.error) {
      setError(result.error);
      return;
    }
    setPreview(result.ok!);

    // Pré-popula mapping com sugestões automáticas pra disciplinas novas
    // que ainda não existem na tabela.
    const suggestions = suggestDisciplinaMapping(
      result.ok!.novasDisciplinaNomes,
      (disciplinas ?? []).map((d) => ({ id: d.id, nome: d.nome }))
    );
    const map = new Map<string, string>();
    for (const s of suggestions) {
      if (s.sugestaoExistenteNome) {
        map.set(s.novoNome, s.sugestaoExistenteNome);
      }
    }
    setDiscMapping(map);
  };

  const startPreview = (text: string) => {
    if (!text || !text.trim()) {
      setError('Vazio.');
      return;
    }
    setupPreview(() => parseImportBatch(text, existing));
  };

  const startPreviewMulti = (files: Array<{ name: string; text: string }>) => {
    if (files.length === 0) {
      setError('Nenhum arquivo.');
      return;
    }
    setupPreview(() => parseImportBatchMulti(files, existing));
  };

  const handleFiles = async (files: FileList | File[]) => {
    const arr = Array.from(files).filter(
      (f) => f.name.toLowerCase().endsWith('.json') || /json/i.test(f.type)
    );
    if (!arr.length) {
      toast('Nenhum arquivo JSON.', 'warn');
      return;
    }
    if (arr.length === 1) {
      const text = await arr[0].text();
      startPreview(text);
      return;
    }
    // Multi-file: lê todos em paralelo, agrega num único preview
    try {
      const contents = await Promise.all(
        arr.map(async (f) => ({ name: f.name, text: await f.text() }))
      );
      startPreviewMulti(contents);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError('Falha ao ler arquivos: ' + msg);
    }
  };

  const confirmImport = () => {
    if (!preview || !userId) return;
    const assign = buildAssign();

    // Aplica mapping de disciplinas + atribuição em lote
    let items: NormalizedItem[] = applyDisciplinaMapping(preview.toImport, discMapping);
    if (assign.discNome || assign.concursoId || assign.topicoId) {
      items = items.map((item) => ({
        ...item,
        topico_id: assign.topicoId ?? item.topico_id ?? null,
        concurso_id: assign.concursoId ?? item.concurso_id ?? null,
        disciplina_id: assign.discNome ?? item.disciplina_id,
      }));
    }

    addQuestionsBulk(items, userId);
    scheduleSync(800);

    // Auto-cria disciplinas pra cada nome final único
    const nomes = items
      .map((n) => n.disciplina_id)
      .filter((d): d is string => !!d);
    void ensureDisciplinasExist(nomes);

    const nReal = items.filter((i) => i.origem === 'real').length;
    const nAuto = items.length - nReal;
    const partes: string[] = [];
    if (nReal) partes.push(`${nReal} real(is)`);
    if (nAuto) partes.push(`${nAuto} autoral(is)`);
    toast(`${items.length} questão(ões) importada(s) — ${partes.join(' + ')}.`, 'success');

    // Reset
    setPreview(null);
    setDiscMapping(new Map());
    setPaste('');
  };

  const cancelPreview = () => {
    setPreview(null);
    setDiscMapping(new Map());
    setError(null);
  };

  const temHierarquia =
    (concursos?.length ?? 0) > 0 ||
    (disciplinas?.length ?? 0) > 0 ||
    (topicos?.length ?? 0) > 0;

  return (
    <div className="card">
      <h2>Importar questões</h2>
      <p className="muted">
        Aceita formato <strong>autoral</strong> (com <code>disciplina_id</code>)
        ou formato <strong>real</strong> (de QConcursos: com <code>materia</code>{' '}
        + <code>concursoAno</code>). Detecta automaticamente.
      </p>

      {/* Atribuição em lote */}
      {temHierarquia && !preview && (
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
                <span className="muted" style={{ fontSize: '0.82rem' }}>Concurso</span>
                <select
                  value={assignConcursoId}
                  onChange={(e) => setAssignConcursoId(e.target.value)}
                  style={{ minWidth: 200 }}
                >
                  <option value="">— Nenhum —</option>
                  {concursos?.map((c) => (
                    <option key={c.id} value={c.id}>{c.nome}</option>
                  ))}
                </select>
              </label>
            )}
            {(disciplinas?.length ?? 0) > 0 && (
              <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span className="muted" style={{ fontSize: '0.82rem' }}>Disciplina (sobrescreve)</span>
                <select
                  value={assignDiscId}
                  onChange={(e) => {
                    setAssignDiscId(e.target.value);
                    setAssignTopicoId('');
                  }}
                  style={{ minWidth: 200 }}
                >
                  <option value="">— Manter do JSON / mapping —</option>
                  {disciplinas?.map((d) => (
                    <option key={d.id} value={d.id}>{d.nome}</option>
                  ))}
                </select>
              </label>
            )}
            {(topicos?.length ?? 0) > 0 && (
              <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span className="muted" style={{ fontSize: '0.82rem' }}>Tópico</span>
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
                      <option key={t.id} value={t.id}>{prefix}{t.nome}</option>
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

      {/* Dropzone — só quando NÃO tá em preview */}
      {!preview && (
        <>
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
            onDragEnter={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              if (e.dataTransfer?.files?.length) void handleFiles(e.dataTransfer.files);
            }}
          >
            <span className="icon" aria-hidden>⬆</span>
            <strong>Arraste arquivos JSON aqui</strong>
            <span>ou clique para selecionar (vários OK)</span>
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
              placeholder='Cole o JSON. Suporta array, objeto único, ou objeto com chave "questions".'
            />
            <div className="row gap">
              <button type="button" className="primary" onClick={() => startPreview(paste)}>
                Analisar JSON colado
              </button>
              <button type="button" onClick={() => setPaste('')}>Limpar</button>
            </div>
          </details>
        </>
      )}

      {error && (
        <div className="import-report fail" role="alert">
          <strong>Erro:</strong> {error}
        </div>
      )}

      {preview && (
        <PreviewPanel
          preview={preview}
          discMapping={discMapping}
          setDiscMapping={setDiscMapping}
          existingDisciplinas={disciplinas ?? []}
          onConfirm={confirmImport}
          onCancel={cancelPreview}
        />
      )}
    </div>
  );
}

function PreviewPanel({
  preview,
  discMapping,
  setDiscMapping,
  existingDisciplinas,
  onConfirm,
  onCancel,
}: {
  preview: BatchParseResult;
  discMapping: Map<string, string>;
  setDiscMapping: (m: Map<string, string>) => void;
  existingDisciplinas: Array<{ id: string; nome: string }>;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  // Suggestions só pras disciplinas que NÃO existem case-insensitive
  const existentesLower = new Set(
    existingDisciplinas.map((d) => d.nome.toLowerCase())
  );
  const novasNaoExistentes = preview.novasDisciplinaNomes.filter(
    (n) => !existentesLower.has(n.toLowerCase())
  );

  const updateMapping = (novoNome: string, valor: string) => {
    const next = new Map(discMapping);
    if (valor === '__keep__') {
      next.delete(novoNome);
    } else {
      next.set(novoNome, valor);
    }
    setDiscMapping(next);
  };

  return (
    <div
      style={{
        border: '1px solid var(--primary)',
        borderRadius: 'var(--radius)',
        padding: 14,
        background: 'var(--bg-elev-2)',
      }}
    >
      <h3 style={{ marginTop: 0 }}>Preview</h3>

      <div className="row gap wrap" style={{ fontSize: '0.92rem', marginBottom: 12 }}>
        <span><strong>{preview.toImport.length}</strong> a importar</span>
        {preview.realCount > 0 && (
          <span className="muted">
            (📋 {preview.realCount} real{preview.realCount !== 1 ? 'is' : ''})
          </span>
        )}
        {preview.autoralCount > 0 && (
          <span className="muted">
            (✏️ {preview.autoralCount} autoral{preview.autoralCount !== 1 ? 'is' : ''})
          </span>
        )}
        {preview.duplicateInDbCount > 0 && (
          <span style={{ color: 'var(--warn, #d97706)' }}>
            · {preview.duplicateInDbCount} duplicada(s) já no banco (ignoradas)
          </span>
        )}
        {preview.duplicateInBatchCount > 0 && (
          <span style={{ color: 'var(--warn, #d97706)' }}>
            · {preview.duplicateInBatchCount} duplicada(s) no próprio arquivo
          </span>
        )}
        {preview.realDiscarded.length > 0 && (
          <span style={{ color: 'var(--danger)' }}>
            · {preview.realDiscarded.length} descartada(s)
          </span>
        )}
        {preview.unknownCount > 0 && (
          <span style={{ color: 'var(--danger)' }}>
            · {preview.unknownCount} formato desconhecido
          </span>
        )}
      </div>

      {/* Descartadas — quando há, mostra detalhe */}
      {preview.realDiscarded.length > 0 && (
        <details style={{ marginBottom: 12 }}>
          <summary style={{ cursor: 'pointer', fontWeight: 500 }}>
            ⚠ {preview.realDiscarded.length} questão(ões) descartada(s) — ver motivos
          </summary>
          <ul style={{ marginTop: 8, fontSize: '0.85rem' }}>
            {preview.realDiscarded.slice(0, 50).map((d, i) => (
              <li key={i}>
                <code>#{d.numero ?? d.externalId ?? '?'}</code>{' '}
                ({d.disciplinaNome ?? 'sem disciplina'}): {d.reason}
              </li>
            ))}
            {preview.realDiscarded.length > 50 && (
              <li>… e {preview.realDiscarded.length - 50} a mais</li>
            )}
          </ul>
        </details>
      )}

      {preview.autoralErrors.length > 0 && (
        <details style={{ marginBottom: 12 }}>
          <summary style={{ cursor: 'pointer', fontWeight: 500 }}>
            ⚠ {preview.autoralErrors.length} autoral(is) com erro de validação
          </summary>
          <ul style={{ marginTop: 8, fontSize: '0.85rem' }}>
            {preview.autoralErrors.slice(0, 50).map((e, i) => <li key={i}>{e}</li>)}
          </ul>
        </details>
      )}

      {/* Avisos de cross-disciplina (mesmo enunciado em outra disc) */}
      {preview.crossDiscWarnings.length > 0 && (
        <details
          open
          style={{
            marginBottom: 12,
            border: '1px solid var(--warn, #d97706)',
            borderRadius: 'var(--radius)',
            padding: '8px 12px',
            background: 'var(--bg-elev)',
          }}
        >
          <summary style={{ cursor: 'pointer', fontWeight: 500 }}>
            ⚠ {preview.crossDiscWarnings.length} possível(eis) duplicata(s) cross-disciplina
          </summary>
          <p className="muted" style={{ marginTop: 8, fontSize: '0.85rem' }}>
            Estes itens têm <strong>mesmo enunciado</strong> que questões já
            existentes, mas em <strong>disciplina diferente</strong>.
            Provavelmente são as mesmas questões — ajuste o mapping de
            disciplina abaixo pra dedupar.
          </p>
          <ul
            style={{
              listStyle: 'none',
              padding: 0,
              margin: '8px 0 0',
              fontSize: '0.82rem',
              maxHeight: 200,
              overflowY: 'auto',
            }}
          >
            {preview.crossDiscWarnings.slice(0, 30).map((w, i) => (
              <li key={i} style={{ padding: '3px 0' }}>
                <code>{w.novoDisc}</code> →{' '}
                já existe em <code>{w.discsExistentes.join(', ')}</code>
                <br />
                <span className="muted">
                  &nbsp;&nbsp;{w.enunciadoPreview}…
                </span>
              </li>
            ))}
            {preview.crossDiscWarnings.length > 30 && (
              <li className="muted">
                … e {preview.crossDiscWarnings.length - 30} a mais
              </li>
            )}
          </ul>
        </details>
      )}

      {/* Mapping de disciplinas novas */}
      {novasNaoExistentes.length > 0 && (
        <div style={{ marginBottom: 14 }}>
          <h4 style={{ margin: '0 0 6px' }}>
            Disciplinas novas detectadas ({novasNaoExistentes.length})
          </h4>
          <p className="muted" style={{ marginTop: 0, fontSize: '0.85rem' }}>
            Cada uma destas não existe na sua app. Você pode mapear pra
            uma existente (recomendado quando há sugestão de match) ou
            manter como nova disciplina.
          </p>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {novasNaoExistentes.map((nome) => {
              const mapped = discMapping.get(nome);
              return (
                <li key={nome} className="row gap wrap" style={{ alignItems: 'center', background: 'var(--bg-elev)', padding: '6px 10px', borderRadius: 'var(--radius)' }}>
                  <span style={{ fontFamily: 'monospace', flex: '0 0 auto', wordBreak: 'break-all' }}>
                    {nome}
                  </span>
                  <span style={{ flex: '0 0 auto' }}>→</span>
                  <select
                    value={mapped ?? '__keep__'}
                    onChange={(e) => updateMapping(nome, e.target.value)}
                    style={{ flex: '1 1 220px', minWidth: 220 }}
                  >
                    <option value="__keep__">
                      ➕ Criar como nova: "{nome}"
                    </option>
                    {existingDisciplinas.map((d) => (
                      <option key={d.id} value={d.nome}>
                        Mapear para: {d.nome}
                      </option>
                    ))}
                  </select>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* Ações */}
      <div className="row gap right" style={{ marginTop: 16 }}>
        <button type="button" className="ghost" onClick={onCancel}>
          Cancelar
        </button>
        <button
          type="button"
          className="primary"
          onClick={onConfirm}
          disabled={preview.toImport.length === 0}
        >
          Importar {preview.toImport.length} questão(ões)
        </button>
      </div>
    </div>
  );
}
