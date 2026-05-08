'use client';

import { useState } from 'react';
import {
  getAIKey,
  getDefaultProvider,
} from '@/lib/ai-keys';
import { getActivePersonaPrompt, withPersona } from '@/lib/persona-active';
import { toast } from './Toast';
import type { Question } from '@/lib/types';

type Pair = { qa: Question; qb: Question; sim: number };

/**
 * Refina pairs de near-duplicatas via IA: pra cada par, IA julga se é
 * REALMENTE o mesmo conceito (mesmo wording diferente) ou só similar
 * superficial. Filtra falsos positivos.
 *
 * Batch: 5 pares por chamada pra economizar.
 */
function buildPrompt(batch: Pair[]): string {
  const lines: string[] = [
    'Você é um avaliador de questões de concurso. Pra cada PAR abaixo, julgue se as duas questões testam o MESMO conceito (sim) ou só são parecidas mas diferentes (não).',
    '',
  ];
  batch.forEach((p, i) => {
    const a = (p.qa.payload as { enunciado?: string }).enunciado ?? '';
    const b = (p.qb.payload as { enunciado?: string }).enunciado ?? '';
    lines.push(`PAR ${i + 1}:`);
    lines.push(`A: ${a.slice(0, 400)}`);
    lines.push(`B: ${b.slice(0, 400)}`);
    lines.push('');
  });
  lines.push(
    'Responda APENAS com JSON: {"results":[{"par":1,"duplicate":true,"reason":"<até 50 chars>"}, ...]}'
  );
  return lines.join('\n');
}

function parseResponse(text: string): Map<number, { duplicate: boolean; reason: string }> {
  const out = new Map<number, { duplicate: boolean; reason: string }>();
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) return out;
  try {
    const j = JSON.parse(m[0]);
    if (Array.isArray(j.results)) {
      for (const r of j.results) {
        if (typeof r?.par === 'number') {
          out.set(r.par, {
            duplicate: r.duplicate === true,
            reason: typeof r.reason === 'string' ? r.reason : '',
          });
        }
      }
    }
  } catch {
    /* ignore */
  }
  return out;
}

export function AIDuplicateRefineButton({
  pairs,
  onRefined,
}: {
  pairs: Pair[];
  onRefined: (filtered: Pair[]) => void;
}) {
  const provider = getDefaultProvider();
  const [loading, setLoading] = useState(false);

  if (!provider) return null;
  if (pairs.length === 0) return null;

  const refine = async () => {
    const apiKey = getAIKey(provider);
    if (!apiKey) {
      toast('Chave IA não configurada', 'error');
      return;
    }
    setLoading(true);
    try {
      const personaPrompt = await getActivePersonaPrompt();
      const BATCH = 5;
      const confirmed: Pair[] = [];
      for (let i = 0; i < pairs.length; i += BATCH) {
        const batch = pairs.slice(i, i + BATCH);
        const res = await fetch('/api/ai/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            provider,
            apiKey,
            prompt: withPersona(buildPrompt(batch), personaPrompt),
            kind: 'dedup-refine',
            cacheable: !personaPrompt,
          }),
        });
        if (!res.ok) continue;
        const j = (await res.json()) as { text: string };
        const parsed = parseResponse(j.text ?? '');
        batch.forEach((p, j2) => {
          const r = parsed.get(j2 + 1);
          if (r?.duplicate) confirmed.push(p);
        });
      }
      onRefined(confirmed);
      toast(
        `IA confirmou ${confirmed.length} de ${pairs.length} pares como duplicatas reais.`,
        'success'
      );
    } catch (e) {
      toast(e instanceof Error ? e.message : 'erro', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      type="button"
      className="ghost"
      onClick={refine}
      disabled={loading}
      title="IA filtra falsos positivos do scanner Jaccard"
      style={{ padding: '6px 12px', fontSize: '0.85rem' }}
    >
      {loading ? '🤖 Refinando…' : '🤖 Refinar via IA'}
    </button>
  );
}
