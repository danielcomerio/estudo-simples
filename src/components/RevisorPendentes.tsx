'use client';

import { useMemo, useState } from 'react';
import {
  selectActiveQuestions,
  updateQuestionLocal,
  useStore,
} from '@/lib/store';
import { scheduleSync } from '@/lib/sync';
import {
  matchActiveConcurso,
  useActiveConcursoFilter,
} from '@/lib/hierarchy';
import {
  applyAnswer,
  formatBatchForAI,
  parseAIResponse,
} from '@/lib/revisor';
import type { ObjetivaPayload, Question } from '@/lib/types';
import { toast } from './Toast';

/**
 * Página de bulk-fill de gabarito.
 *
 * Workflow:
 *  1. Filtra questões pendentes (verificacao='pendente'). Aplica filtro
 *     de concurso ativo se houver, e select por disciplina.
 *  2. User escolhe quantas levar pra IA (batch size). Default 25.
 *  3. Botão "Gerar prompt" → exibe texto formatado + copia clipboard.
 *  4. User cola na IA, recebe respostas, cola na textarea.
 *  5. Preview mostra: pra cada questão do batch, qual letra a IA
 *     respondeu, se a letra existe na questão (✓/✗), e o que vai
 *     ser aplicado.
 *  6. Botão "Aplicar gabaritos" → updateQuestionLocal pra cada uma
 *     com matching, marca verificacao='verificada'. As que falharam
 *     ficam pendentes pra próxima rodada.
 */
export function RevisorPendentes() {
  const allQuestions = useStore(selectActiveQuestions);
  const { concurso: activeConcurso, disciplinaNomes: concursoDiscNomes } =
    useActiveConcursoFilter();

  // Pendentes filtradas por concurso ativo (se houver)
  const pendentes = useMemo(() => {
    return allQuestions.filter(
      (q) =>
        q.type === 'objetiva' &&
        q.verificacao === 'pendente' &&
        matchActiveConcurso(q.disciplina_id, concursoDiscNomes)
    );
  }, [allQuestions, concursoDiscNomes]);

  const disciplinasUnicas = useMemo(() => {
    const set = new Set<string>();
    for (const q of pendentes) if (q.disciplina_id) set.add(q.disciplina_id);
    return Array.from(set).sort();
  }, [pendentes]);

  // Filtros
  const [discFilter, setDiscFilter] = useState<string>('');
  const [batchSize, setBatchSize] = useState(25);

  const candidatas = useMemo(() => {
    return discFilter
      ? pendentes.filter((q) => q.disciplina_id === discFilter)
      : pendentes;
  }, [pendentes, discFilter]);

  // Workflow state
  const [batch, setBatch] = useState<Question[] | null>(null);
  const [promptText, setPromptText] = useState('');
  const [responseText, setResponseText] = useState('');

  const parsedAnswers = useMemo(
    () => parseAIResponse(responseText),
    [responseText]
  );

  const matchPreview = useMemo(() => {
    if (!batch) return [];
    return batch.map((q, i) => {
      const num = i + 1;
      const letra = parsedAnswers.get(num);
      const p = q.payload as ObjetivaPayload;
      const exists = !!letra && (p.alternativas ?? []).some(
        (a) => a.letra.toUpperCase() === letra
      );
      return { num, q, letra: letra ?? null, exists };
    });
  }, [batch, parsedAnswers]);

  const okCount = matchPreview.filter((m) => m.letra && m.exists).length;
  const erroCount = matchPreview.filter((m) => m.letra && !m.exists).length;
  const semRespostaCount = matchPreview.filter((m) => !m.letra).length;

  const generatePrompt = () => {
    const slice = candidatas.slice(0, batchSize);
    if (slice.length === 0) {
      toast('Sem pendentes pra revisar com este filtro.', 'warn');
      return;
    }
    const text = formatBatchForAI(slice);
    setBatch(slice);
    setPromptText(text);
    setResponseText('');
    // Tenta copiar pra clipboard
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(
        () => toast('Prompt copiado pro clipboard. Cole na IA.', 'success'),
        () => toast('Falha ao copiar — copie manualmente abaixo.', 'warn')
      );
    }
  };

  const cancel = () => {
    setBatch(null);
    setPromptText('');
    setResponseText('');
  };

  const apply = () => {
    if (!batch) return;
    const matches = matchPreview.filter((m) => m.letra && m.exists);
    if (matches.length === 0) {
      toast('Nenhum match válido pra aplicar.', 'warn');
      return;
    }
    let applied = 0;
    for (const { q, letra } of matches) {
      const newPayload = applyAnswer(q, letra!);
      if (!newPayload) continue;
      updateQuestionLocal(q.id, {
        payload: newPayload,
        verificacao: 'verificada',
      });
      applied++;
    }
    scheduleSync(800);
    toast(`${applied} gabarito(s) aplicado(s) e marcadas verificadas.`, 'success');
    cancel();
  };

  return (
    <>
      <div className="card">
        <h1 style={{ margin: '0 0 8px' }}>Revisar pendentes</h1>
        <p className="muted" style={{ margin: 0 }}>
          Bulk-fill de gabarito. Pra cada lote: gere o prompt, cole na
          IA, traga a resposta de volta e aplique. Questões com gabarito
          ficam <code>verificada</code>.
          {activeConcurso && (
            <>
              {' '}
              Filtrando por concurso ativo: <strong>{activeConcurso.nome}</strong>.
            </>
          )}
        </p>
      </div>

      <div className="card">
        <div className="row gap wrap" style={{ marginBottom: 12 }}>
          <span>
            <strong>{pendentes.length}</strong> pendentes
            {discFilter ? ` · ${candidatas.length} no filtro` : ''}
          </span>
          {disciplinasUnicas.length > 1 && (
            <select
              value={discFilter}
              onChange={(e) => setDiscFilter(e.target.value)}
              disabled={!!batch}
            >
              <option value="">Todas as disciplinas</option>
              {disciplinasUnicas.map((d) => (
                <option key={d} value={d}>
                  {d} ({pendentes.filter((q) => q.disciplina_id === d).length})
                </option>
              ))}
            </select>
          )}
          <label style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
            <span style={{ fontSize: '0.85rem' }}>Tamanho do lote</span>
            <input
              type="number"
              min={1}
              max={100}
              value={batchSize}
              onChange={(e) => setBatchSize(Number(e.target.value) || 25)}
              disabled={!!batch}
              style={{ width: 70 }}
            />
          </label>
        </div>

        {!batch && (
          <div className="row gap">
            <button
              type="button"
              className="primary"
              onClick={generatePrompt}
              disabled={candidatas.length === 0}
            >
              Gerar prompt pra IA ({Math.min(batchSize, candidatas.length)})
            </button>
          </div>
        )}

        {batch && (
          <div>
            <details
              open
              style={{
                marginBottom: 14,
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius)',
                padding: '10px 12px',
                background: 'var(--bg-elev-2)',
              }}
            >
              <summary style={{ cursor: 'pointer', fontWeight: 500 }}>
                Prompt gerado ({batch.length} questões){' '}
                <span className="muted" style={{ fontSize: '0.85rem' }}>
                  — copiado pro clipboard
                </span>
              </summary>
              <textarea
                readOnly
                value={promptText}
                rows={12}
                style={{ width: '100%', marginTop: 10, fontFamily: 'monospace', fontSize: '0.82rem' }}
                onFocus={(e) => e.target.select()}
              />
              <p className="muted" style={{ fontSize: '0.82rem', marginTop: 6 }}>
                Cole na IA e peça pra responder no formato indicado.
              </p>
            </details>

            <label
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
                marginBottom: 14,
              }}
            >
              <span>Resposta da IA *</span>
              <textarea
                value={responseText}
                onChange={(e) => setResponseText(e.target.value)}
                rows={8}
                placeholder="Cole aqui. Ex: Q1: C\nQ2: A\nQ3: E ..."
                style={{ fontFamily: 'monospace', fontSize: '0.85rem' }}
              />
            </label>

            {responseText.trim() && (
              <div
                style={{
                  marginBottom: 14,
                  padding: 10,
                  background: 'var(--bg-elev-2)',
                  borderRadius: 'var(--radius)',
                  border: '1px solid var(--border)',
                }}
              >
                <div className="row gap wrap" style={{ marginBottom: 8, fontSize: '0.9rem' }}>
                  <span>
                    ✅ <strong>{okCount}</strong> match
                  </span>
                  {erroCount > 0 && (
                    <span style={{ color: 'var(--danger)' }}>
                      ⚠ {erroCount} letra(s) não existe(m) na questão
                    </span>
                  )}
                  {semRespostaCount > 0 && (
                    <span style={{ color: 'var(--warn, #d97706)' }}>
                      ⏳ {semRespostaCount} sem resposta
                    </span>
                  )}
                </div>
                <details>
                  <summary
                    style={{ cursor: 'pointer', fontSize: '0.85rem' }}
                  >
                    Ver preview detalhado
                  </summary>
                  <ul
                    style={{
                      listStyle: 'none',
                      padding: 0,
                      margin: '8px 0 0',
                      fontSize: '0.82rem',
                      maxHeight: 240,
                      overflowY: 'auto',
                    }}
                  >
                    {matchPreview.map(({ num, q, letra, exists }) => {
                      const enun = (q.payload as ObjetivaPayload).enunciado ?? '';
                      const status = !letra
                        ? '⏳ sem resposta'
                        : exists
                          ? `✅ ${letra}`
                          : `⚠ ${letra} (inválida)`;
                      return (
                        <li key={num} style={{ padding: '2px 0' }}>
                          <code>Q{num}</code> {status} —{' '}
                          <span className="muted">{enun.slice(0, 80)}…</span>
                        </li>
                      );
                    })}
                  </ul>
                </details>
              </div>
            )}

            <div className="row gap right">
              <button type="button" className="ghost" onClick={cancel}>
                Cancelar
              </button>
              <button
                type="button"
                className="primary"
                onClick={apply}
                disabled={okCount === 0}
              >
                Aplicar {okCount} gabarito(s)
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
