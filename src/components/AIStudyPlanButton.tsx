'use client';

import { useState } from 'react';
import {
  getAIKey,
  getDefaultProvider,
  PROVIDER_LABELS,
} from '@/lib/ai-keys';
import { getActivePersonaPrompt, withPersona } from '@/lib/persona-active';
import { Modal } from './Modal';
import { toast } from './Toast';
import { useStore, selectActiveQuestions } from '@/lib/store';
import { useDisciplinas, useAllConcursoDisciplinas } from '@/lib/hierarchy';

/**
 * Gera roteiro de estudo de 7 dias baseado em:
 *  - Concurso ativo + disciplinas vinculadas com peso
 *  - Stats do user (% acerto por disciplina)
 *  - Horas/dia disponíveis
 *
 * Output: texto markdown com plano dia-a-dia. User pode salvar em
 * localStorage pra reusar.
 */

const KEY = 'estudo-simples:study-plan:v1';

export function AIStudyPlanButton({
  concursoId,
  concursoNome,
}: {
  concursoId: string;
  concursoNome: string;
}) {
  const provider = getDefaultProvider();
  const [open, setOpen] = useState(false);
  const [horas, setHoras] = useState(2);
  const [text, setText] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const questions = useStore(selectActiveQuestions);
  const { data: disciplinas } = useDisciplinas();
  const { data: cdLinks } = useAllConcursoDisciplinas();

  if (!provider) return null;

  const generate = async () => {
    const apiKey = getAIKey(provider);
    if (!apiKey) {
      toast('Chave IA não configurada', 'error');
      return;
    }
    setLoading(true);
    setText('');

    // Coleta stats por disciplina
    type Bucket = { tentativas: number; acertos: number };
    const stats = new Map<string, Bucket>();
    for (const q of questions) {
      const d = q.disciplina_id || 'sem-disciplina';
      const b = stats.get(d) ?? { tentativas: 0, acertos: 0 };
      b.tentativas += q.stats?.attempts ?? 0;
      b.acertos += q.stats?.correct ?? 0;
      stats.set(d, b);
    }

    // Disciplinas vinculadas a este concurso (com peso)
    const links = (cdLinks ?? []).filter((l) => l.concurso_id === concursoId);
    const discsDoConcurso = links
      .map((l) => {
        const d = (disciplinas ?? []).find((x) => x.id === l.disciplina_id);
        if (!d) return null;
        const s = stats.get(d.nome) ?? { tentativas: 0, acertos: 0 };
        const dom = s.tentativas > 0 ? Math.round((s.acertos / s.tentativas) * 100) : null;
        return {
          nome: d.nome,
          peso: l.peso ?? 1,
          dom,
          tentativas: s.tentativas,
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);

    if (discsDoConcurso.length === 0) {
      toast('Concurso sem disciplinas vinculadas. Vá em /concursos pra vincular.', 'warn');
      setLoading(false);
      return;
    }

    const ctx = discsDoConcurso
      .map(
        (d) =>
          `- ${d.nome} (peso: ${d.peso}, ${d.tentativas} tentativas, ${d.dom !== null ? `dom: ${d.dom}%` : 'novo'})`
      )
      .join('\n');

    const promptBase = `Você é um coach de concursos. Gere um plano de estudo de 7 dias pro estudante.

CONCURSO: ${concursoNome}
HORAS POR DIA: ${horas}h
DISCIPLINAS (peso × cobertura atual):
${ctx}

Regras:
- Distribua tempo proporcional ao peso, com BIAS pra disciplinas com baixa cobertura/dom.
- Cada dia tenha foco em 2-3 disciplinas (interleaving).
- 1 dia da semana é simulado curto (sábado/domingo).
- Indique pra cada bloco: tempo + ação concreta (revisar SRS / questões novas / leitura teórica).
- Use markdown com cabeçalhos por dia.
- pt-BR. Direto, sem floreio.`;

    const personaPrompt = await getActivePersonaPrompt();
    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider,
          apiKey,
          prompt: withPersona(promptBase, personaPrompt),
          kind: 'study-plan',
        }),
      });
      const j = await res.json().catch(() => null);
      if (!res.ok) {
        toast(j?.message ?? `Erro (${res.status})`, 'error');
        setLoading(false);
        return;
      }
      const t = (j as { text: string }).text;
      setText(t);
      try {
        localStorage.setItem(
          `${KEY}:${concursoId}`,
          JSON.stringify({ text: t, savedAt: Date.now(), horas })
        );
      } catch {
        /* ignore */
      }
    } catch (e) {
      toast(e instanceof Error ? e.message : 'erro', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setOpen(true);
          // Restaura plano salvo
          try {
            const cached = localStorage.getItem(`${KEY}:${concursoId}`);
            if (cached) {
              const j = JSON.parse(cached);
              if (j?.text) setText(j.text);
              if (typeof j?.horas === 'number') setHoras(j.horas);
            }
          } catch {
            /* ignore */
          }
        }}
        title={`Gerar plano semanal via ${PROVIDER_LABELS[provider]}`}
        style={{ padding: '6px 12px', fontSize: '0.85rem' }}
      >
        🤖 Gerar plano semanal
      </button>
      {open && (
        <Modal onClose={() => setOpen(false)} ariaLabel="Plano de estudo">
          <div style={{ padding: 12 }}>
            <h3 style={{ margin: '0 0 12px' }}>🤖 Plano de estudo (7 dias)</h3>
            <label className="row gap" style={{ alignItems: 'center', marginBottom: 12 }}>
              <span style={{ fontSize: '0.92rem' }}>Horas por dia:</span>
              <input
                type="number"
                min={0.5}
                max={12}
                step={0.5}
                value={horas}
                onChange={(e) => setHoras(parseFloat(e.target.value) || 2)}
                style={{ width: 80 }}
              />
            </label>
            <button
              type="button"
              className="primary"
              onClick={generate}
              disabled={loading}
              style={{ marginBottom: 12 }}
            >
              {loading ? 'Gerando…' : text ? '↻ Refazer plano' : 'Gerar plano'}
            </button>
            {text && (
              <div
                style={{
                  whiteSpace: 'pre-wrap',
                  padding: 12,
                  background: 'var(--bg-elev-2)',
                  borderRadius: 'var(--radius)',
                  fontSize: '0.9rem',
                  lineHeight: 1.6,
                  maxHeight: '60vh',
                  overflowY: 'auto',
                }}
              >
                {text}
              </div>
            )}
          </div>
        </Modal>
      )}
    </>
  );
}
