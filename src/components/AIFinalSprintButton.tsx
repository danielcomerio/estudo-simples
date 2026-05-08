'use client';

import { useState } from 'react';
import { selectActiveQuestions, useStore } from '@/lib/store';
import {
  getAIKey,
  getDefaultProvider,
  PROVIDER_LABELS,
} from '@/lib/ai-keys';
import { getActivePersonaPrompt, withPersona } from '@/lib/persona-active';
import { Modal } from './Modal';
import { toast } from './Toast';
import { useAllConcursoDisciplinas, useDisciplinas } from '@/lib/hierarchy';

const DAY_MS = 86_400_000;

/**
 * Botão "🎯 Plano final" que aparece em cada concurso COM data_prova
 * preenchida e a poucas semanas. IA gera plano dia-a-dia priorizando
 * inimigas + revisão SRS.
 */
export function AIFinalSprintButton({
  concursoId,
  concursoNome,
  dataProva,
}: {
  concursoId: string;
  concursoNome: string;
  dataProva: string; // ISO date
}) {
  const provider = getDefaultProvider();
  const all = useStore(selectActiveQuestions);
  const { data: disciplinas } = useDisciplinas();
  const { data: cdLinks } = useAllConcursoDisciplinas();

  const [open, setOpen] = useState(false);
  const [text, setText] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (!provider) return null;

  const provaMs = new Date(dataProva).getTime();
  const diasRestantes = Math.max(0, Math.floor((provaMs - Date.now()) / DAY_MS));
  if (diasRestantes === 0 || diasRestantes > 60) return null; // só se em ≤60 dias

  const ask = async () => {
    const apiKey = getAIKey(provider);
    if (!apiKey) {
      toast('Sem chave', 'error');
      return;
    }
    setLoading(true);
    setText('');

    // Coleta inimigas e disciplinas vinculadas
    const links = (cdLinks ?? []).filter((l) => l.concurso_id === concursoId);
    const discs = links.map((l) => {
      const d = (disciplinas ?? []).find((x) => x.id === l.disciplina_id);
      return d?.nome ?? null;
    }).filter((x): x is string => !!x);

    type Stat = { tents: number; corrects: number };
    const byDisc = new Map<string, Stat>();
    for (const q of all) {
      const d = q.disciplina_id ?? '';
      if (!discs.includes(d)) continue;
      const s = byDisc.get(d) ?? { tents: 0, corrects: 0 };
      s.tents += q.stats?.attempts ?? 0;
      s.corrects += q.stats?.correct ?? 0;
      byDisc.set(d, s);
    }
    const fracas = Array.from(byDisc.entries())
      .filter(([, s]) => s.tents >= 3)
      .map(([d, s]) => ({ d, pct: Math.round((s.corrects / s.tents) * 100) }))
      .sort((a, b) => a.pct - b.pct)
      .slice(0, 5);

    const promptBase = `Estudante tem prova em ${diasRestantes} dia(s) para "${concursoNome}".

DISCIPLINAS DA PROVA: ${discs.join(', ')}

PIORES PERFORMANCES:
${fracas.map((f) => `- ${f.d}: ${f.pct}% acerto`).join('\n')}

Gere plano DIA-A-DIA pros próximos ${Math.min(diasRestantes, 14)} dias (max 14):
- Cada dia: 1-2 disciplinas focadas
- Mistura de SRS (vencidas) + simulado + revisão de inimigas
- Reserva último dia pra simulado completo + descanso ativo
- Tom motivacional mas direto

Use markdown com headers "## Dia 1", "## Dia 2", etc.
pt-BR, max 800 palavras.`;

    const personaPrompt = await getActivePersonaPrompt();
    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider,
          apiKey,
          prompt: withPersona(promptBase, personaPrompt),
          kind: 'final-sprint',
        }),
      });
      const j = await res.json().catch(() => null);
      if (!res.ok) {
        toast(j?.message ?? `Erro (${res.status})`, 'error');
        return;
      }
      setText((j as { text: string }).text);
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
        className="primary"
        onClick={() => {
          setOpen(true);
          if (!text) void ask();
        }}
        title={`Plano final dos ${diasRestantes} dias via ${PROVIDER_LABELS[provider]}`}
        style={{ padding: '6px 12px', fontSize: '0.85rem' }}
      >
        🎯 Plano final ({diasRestantes}d)
      </button>
      {open && (
        <Modal onClose={() => setOpen(false)} ariaLabel="Plano final" maxWidth="720px">
          <div style={{ padding: 14 }}>
            <h3 style={{ margin: '0 0 12px' }}>
              🎯 {concursoNome} — plano dos {diasRestantes} dias finais
            </h3>
            {loading && <p>Gerando…</p>}
            {text && (
              <div
                style={{
                  whiteSpace: 'pre-wrap',
                  padding: 12,
                  background: 'var(--bg-elev-2)',
                  borderRadius: 'var(--radius)',
                  fontSize: '0.92rem',
                  lineHeight: 1.55,
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
