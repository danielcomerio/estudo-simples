'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Modal } from './Modal';
import { addQuestionLocal, useStore } from '@/lib/store';
import { scheduleSync } from '@/lib/sync';
import {
  getAIKey,
  getDefaultProvider,
  PROVIDER_LABELS,
} from '@/lib/ai-keys';
import {
  buildGenerationPrompt,
  parseAndValidate,
  type GenerateConfig,
  type GeneratedQuestion,
} from '@/lib/ai-generate';
import type { QuestionType } from '@/lib/types';
import { toast } from './Toast';

/**
 * Botão "🤖 Gerar com IA" no toolbar do BancoList.
 *
 * Fluxo wizard:
 *  1. Step config: tema, qtd, tipo, banca, disciplina, dificuldade
 *  2. Step loading: chama /api/ai/chat (sem stream — JSON precisa fechar
 *     antes de validar)
 *  3. Step preview: lista com checkboxes; user revê, edita opcionalmente,
 *     aceita selecionadas → addQuestionLocal pra cada
 *
 * Sem chave configurada: link discreto pra /configuracoes (não bloqueia
 * outras ações do toolbar).
 */
export function AIGenerateButton({
  defaultDisciplina,
}: {
  defaultDisciplina?: string;
}) {
  const [open, setOpen] = useState(false);
  const provider = getDefaultProvider();

  if (!provider) {
    return (
      <Link
        href="/configuracoes"
        title="Configure uma chave de IA pra gerar questões"
        style={{
          fontSize: '0.85rem',
          color: 'var(--muted)',
          textDecoration: 'underline',
          padding: '6px 12px',
        }}
      >
        🤖 Configurar IA
      </Link>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title={`Gerar questões via ${PROVIDER_LABELS[provider]}`}
        style={{
          background: 'var(--primary-soft)',
          border: '1px solid var(--primary)',
          color: 'var(--primary)',
          fontWeight: 500,
        }}
      >
        🤖 Gerar com IA
      </button>
      {open && (
        <AIGenerateWizard
          onClose={() => setOpen(false)}
          defaultDisciplina={defaultDisciplina}
        />
      )}
    </>
  );
}

type Step = 'config' | 'loading' | 'preview';

function AIGenerateWizard({
  onClose,
  defaultDisciplina,
}: {
  onClose: () => void;
  defaultDisciplina?: string;
}) {
  const provider = getDefaultProvider();
  const userId = useStore((s) => s.userId);
  const [step, setStep] = useState<Step>('config');
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<GeneratedQuestion[]>([]);
  const [discarded, setDiscarded] = useState(0);
  const [selected, setSelected] = useState<Set<number>>(new Set());

  // Config inputs
  const [topic, setTopic] = useState('');
  const [qtd, setQtd] = useState(5);
  const [type, setType] = useState<QuestionType>('objetiva');
  const [banca, setBanca] = useState('FGV');
  const [disciplina, setDisciplina] = useState(defaultDisciplina ?? '');
  const [dificuldade, setDificuldade] = useState(3);

  if (!provider) return null;

  async function generate() {
    if (!topic.trim()) {
      setError('Informe um tema/comando');
      return;
    }
    setError(null);
    setStep('loading');
    const apiKey = getAIKey(provider!);
    if (!apiKey) {
      setError('Chave não configurada');
      setStep('config');
      return;
    }
    const cfg: GenerateConfig = {
      topic: topic.trim(),
      qtd: Math.max(1, Math.min(20, qtd)),
      type,
      banca: banca.trim() || undefined,
      disciplina: disciplina.trim() || undefined,
      dificuldade,
    };
    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider,
          apiKey,
          prompt: buildGenerationPrompt(cfg),
          // cacheable false — prompt criativo, mesma config gera coisas
          // diferentes; cache atrapalharia
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        setError(json?.message ?? `Erro do provider (${res.status})`);
        setStep('config');
        return;
      }
      const text = (json as { text: string }).text;
      const result = parseAndValidate(text, cfg);
      if (result.items.length === 0) {
        setError(
          `Nenhuma questão válida foi gerada (${result.discarded} descartadas). Tente reformular o tema.`
        );
        setStep('config');
        return;
      }
      setItems(result.items);
      setDiscarded(result.discarded);
      setSelected(new Set(result.items.map((_, i) => i)));
      setStep('preview');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro de rede');
      setStep('config');
    }
  }

  function toggle(idx: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  }

  async function accept() {
    if (!userId) {
      toast('Não autenticado', 'error');
      return;
    }
    const toAdd = items.filter((_, i) => selected.has(i));
    let added = 0;
    for (const q of toAdd) {
      try {
        addQuestionLocal(
          {
            type: q.type,
            disciplina_id: q.disciplina_id ?? null,
            tema: q.tema ?? null,
            banca_estilo: q.banca_estilo ?? null,
            dificuldade: q.dificuldade ?? null,
            payload: q.payload as never,
            tags: ['gabarito-ia'],
            origem: 'autoral',
            fonte: { gabarito_source: 'ia' },
            verificacao: 'pendente',
            srs: { dueDate: 0, repetitions: 0, easeFactor: 2.5, interval: 0, lastReviewed: null },
            stats: { attempts: 0, correct: 0, wrong: 0, history: [] },
            deleted_at: null,
            topico_id: null,
            concurso_id: null,
          },
          userId
        );
        added++;
      } catch (e) {
        console.warn('[ai-gen] falha ao adicionar', e);
      }
    }
    if (added > 0) {
      scheduleSync(500);
      toast(
        `${added} questão(ões) adicionada(s) ao banco. Tag: gabarito-ia`,
        'success'
      );
      onClose();
    } else {
      toast('Nenhuma questão foi adicionada', 'warn');
    }
  }

  return (
    <Modal
      onClose={onClose}
      ariaLabel="Gerar questões via IA"
      maxWidth={680}
    >
      <h2 style={{ margin: '0 0 6px' }}>🤖 Gerar questões via IA</h2>
      <p
        className="muted"
        style={{ margin: '0 0 14px', fontSize: '0.85rem' }}
      >
        Usando {PROVIDER_LABELS[provider]} (BYO key). Questões geradas vêm
        com tag <code>gabarito-ia</code> e <code>verificacao=pendente</code> —
        revise antes de confiar.
      </p>

      {step === 'config' && (
        <>
          <div style={{ display: 'grid', gap: 10 }}>
            <label>
              <div style={{ fontSize: '0.85rem', marginBottom: 4 }}>
                Tema / comando
              </div>
              <textarea
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                rows={3}
                placeholder="Ex: Princípios da administração pública na CF/88, focando em legalidade e moralidade"
                style={{ width: '100%', resize: 'vertical' }}
              />
            </label>

            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <label style={{ flex: '1 1 100px' }}>
                <div style={{ fontSize: '0.85rem', marginBottom: 4 }}>
                  Quantidade
                </div>
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={qtd}
                  onChange={(e) =>
                    setQtd(parseInt(e.target.value, 10) || 1)
                  }
                />
              </label>

              <label style={{ flex: '1 1 140px' }}>
                <div style={{ fontSize: '0.85rem', marginBottom: 4 }}>Tipo</div>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value as QuestionType)}
                >
                  <option value="objetiva">Objetiva</option>
                  <option value="discursiva">Discursiva</option>
                  <option value="cloze">Cloze</option>
                  <option value="flashcard">Flashcard</option>
                </select>
              </label>

              <label style={{ flex: '1 1 100px' }}>
                <div style={{ fontSize: '0.85rem', marginBottom: 4 }}>
                  Dificuldade
                </div>
                <select
                  value={dificuldade}
                  onChange={(e) => setDificuldade(parseInt(e.target.value, 10))}
                >
                  <option value={1}>1 — fácil</option>
                  <option value={2}>2</option>
                  <option value={3}>3 — média</option>
                  <option value={4}>4</option>
                  <option value={5}>5 — difícil</option>
                </select>
              </label>
            </div>

            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <label style={{ flex: 1 }}>
                <div style={{ fontSize: '0.85rem', marginBottom: 4 }}>
                  Banca (estilo)
                </div>
                <input
                  type="text"
                  value={banca}
                  onChange={(e) => setBanca(e.target.value)}
                  placeholder="FGV, Cebraspe, FCC..."
                />
              </label>
              <label style={{ flex: 1 }}>
                <div style={{ fontSize: '0.85rem', marginBottom: 4 }}>
                  Disciplina
                </div>
                <input
                  type="text"
                  value={disciplina}
                  onChange={(e) => setDisciplina(e.target.value)}
                  placeholder="Direito Constitucional"
                />
              </label>
            </div>
          </div>

          {error && (
            <p
              style={{
                color: 'var(--danger)',
                fontSize: '0.85rem',
                marginTop: 10,
              }}
            >
              ⚠ {error}
            </p>
          )}

          <div className="row gap" style={{ marginTop: 16 }}>
            <button type="button" className="primary" onClick={generate}>
              Gerar →
            </button>
            <button type="button" onClick={onClose}>
              Cancelar
            </button>
          </div>
        </>
      )}

      {step === 'loading' && (
        <div style={{ textAlign: 'center', padding: '32px 0' }}>
          <div style={{ fontSize: '2rem', marginBottom: 12 }}>🤖</div>
          <div>Gerando {qtd} questão(ões)…</div>
          <div
            className="muted"
            style={{ fontSize: '0.82rem', marginTop: 8 }}
          >
            Pode levar até ~30s
          </div>
        </div>
      )}

      {step === 'preview' && (
        <>
          <div
            className="muted"
            style={{
              fontSize: '0.85rem',
              marginBottom: 12,
              padding: 8,
              background: 'var(--bg-elev-2)',
              borderRadius: 6,
            }}
          >
            ✓ {items.length} válida(s){' '}
            {discarded > 0 && `· ${discarded} descartada(s)`}. Selecione as
            que quer adicionar ao banco.
          </div>

          <div className="row gap" style={{ marginBottom: 10 }}>
            <button
              type="button"
              onClick={() =>
                setSelected(new Set(items.map((_, i) => i)))
              }
            >
              Selecionar todas
            </button>
            <button type="button" onClick={() => setSelected(new Set())}>
              Limpar
            </button>
            <span className="muted" style={{ fontSize: '0.82rem' }}>
              {selected.size}/{items.length}
            </span>
          </div>

          <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 14px' }}>
            {items.map((q, i) => (
              <PreviewItem
                key={i}
                question={q}
                checked={selected.has(i)}
                onToggle={() => toggle(i)}
              />
            ))}
          </ul>

          <div className="row gap">
            <button
              type="button"
              className="primary"
              onClick={accept}
              disabled={selected.size === 0}
            >
              ✓ Adicionar {selected.size} ao banco
            </button>
            <button type="button" onClick={() => setStep('config')}>
              ← Refazer
            </button>
            <button type="button" onClick={onClose}>
              Cancelar
            </button>
          </div>
        </>
      )}
    </Modal>
  );
}

function PreviewItem({
  question,
  checked,
  onToggle,
}: {
  question: GeneratedQuestion;
  checked: boolean;
  onToggle: () => void;
}) {
  const p = question.payload as Record<string, unknown>;
  const enunciado =
    (p.enunciado as string) ??
    (p.texto as string) ??
    (p.frente as string) ??
    '(sem enunciado)';
  const correta =
    question.type === 'objetiva' && Array.isArray(p.alternativas)
      ? (p.alternativas as Array<{ correta?: boolean; letra: string }>).find(
          (a) => a.correta
        )?.letra
      : null;

  return (
    <li
      style={{
        padding: 12,
        marginBottom: 8,
        border: '1px solid var(--border)',
        borderRadius: 8,
        background: checked ? 'var(--primary-soft)' : 'var(--bg-elev-2)',
        opacity: checked ? 1 : 0.6,
        transition: 'opacity 0.15s, background 0.15s',
      }}
    >
      <label style={{ display: 'flex', gap: 10, cursor: 'pointer' }}>
        <input
          type="checkbox"
          checked={checked}
          onChange={onToggle}
          style={{ marginTop: 4 }}
        />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: '0.78rem',
              color: 'var(--muted)',
              marginBottom: 4,
            }}
          >
            {question.type}
            {question.banca_estilo && ` · ${question.banca_estilo}`}
            {correta && ` · gabarito: ${correta}`}
          </div>
          <div
            style={{
              fontSize: '0.9rem',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
            }}
          >
            {enunciado.length > 300
              ? enunciado.slice(0, 300) + '…'
              : enunciado}
          </div>
          {question.type === 'objetiva' && Array.isArray(p.alternativas) && (
            <details style={{ marginTop: 6 }}>
              <summary
                style={{ cursor: 'pointer', fontSize: '0.82rem', color: 'var(--muted)' }}
              >
                Ver alternativas
              </summary>
              <ul style={{ margin: '6px 0 0', paddingLeft: 18, fontSize: '0.85rem' }}>
                {(
                  p.alternativas as Array<{
                    letra: string;
                    texto: string;
                    correta?: boolean;
                  }>
                ).map((a) => (
                  <li
                    key={a.letra}
                    style={{
                      fontWeight: a.correta ? 600 : 400,
                      color: a.correta ? 'var(--primary)' : undefined,
                    }}
                  >
                    {a.letra}) {a.texto}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      </label>
    </li>
  );
}
