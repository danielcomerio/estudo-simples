'use client';

import { useState } from 'react';
import {
  getAIKey,
  getDefaultProvider,
} from '@/lib/ai-keys';
import { getActivePersonaPrompt, withPersona } from '@/lib/persona-active';
import { selectActiveQuestions, useStore, updateQuestionLocal } from '@/lib/store';
import { scheduleSync } from '@/lib/sync';
import { canonicalTag, allKnownTags } from '@/lib/tag-dictionary';
import { confirmDialog } from './ConfirmDialog';
import { toast } from './Toast';

/**
 * Roda AI tag suggestion em N questões SEM tags. Limit 20 por chamada
 * (bom balanço UX vs custo).
 */
export function AIBulkTagButton() {
  const provider = getDefaultProvider();
  const all = useStore(selectActiveQuestions);
  const [loading, setLoading] = useState(false);

  if (!provider) return null;

  const semTags = all.filter((q) => !q.tags || q.tags.length === 0);
  if (semTags.length === 0) return null;

  const ask = async () => {
    const ok = await confirmDialog({
      title: 'Tagear em massa via IA',
      message: `${semTags.length} questão(ões) sem tags. IA vai propor 3-5 tags pra cada uma das primeiras 20. Custa tokens BYO. Continuar?`,
      danger: false,
    });
    if (!ok) return;

    const apiKey = getAIKey(provider);
    if (!apiKey) {
      toast('Sem chave', 'error');
      return;
    }

    setLoading(true);
    let added = 0;
    let failed = 0;
    const personaPrompt = await getActivePersonaPrompt();
    const known = allKnownTags()
      .map((t) => t.canonical)
      .slice(0, 50)
      .join(', ');

    for (const q of semTags.slice(0, 20)) {
      try {
        const p = q.payload as {
          enunciado?: string;
          frente?: string;
          explicacao_geral?: string;
        };
        const ctx = (p.enunciado ?? p.frente ?? '') + '\n' + (p.explicacao_geral ?? '');
        const promptBase = `Sugira 3-5 tags pra esta questão. Use slugs kebab-case. Use as conhecidas se aplicável: ${known}.

Questão:
${ctx.slice(0, 1500)}

Responda APENAS JSON: {"tags":["..."]}`;
        const res = await fetch('/api/ai/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            provider,
            apiKey,
            prompt: withPersona(promptBase, personaPrompt),
            kind: 'bulk-tag',
            cacheable: !personaPrompt,
          }),
        });
        if (!res.ok) {
          failed++;
          continue;
        }
        const j = (await res.json()) as { text: string };
        const m = (j.text ?? '').match(/\{[\s\S]*\}/);
        if (!m) {
          failed++;
          continue;
        }
        const parsed = JSON.parse(m[0]);
        if (!Array.isArray(parsed.tags)) {
          failed++;
          continue;
        }
        const tags = parsed.tags
          .filter((x: unknown): x is string => typeof x === 'string')
          .map((x: string) => canonicalTag(x))
          .filter((x: string) => !!x)
          .slice(0, 5);
        if (tags.length === 0) {
          failed++;
          continue;
        }
        updateQuestionLocal(q.id, (cur) => ({ ...cur, tags }));
        added++;
      } catch {
        failed++;
      }
    }
    scheduleSync();
    setLoading(false);
    toast(`${added} questões tagueadas, ${failed} falhas.`, 'success');
  };

  return (
    <button
      type="button"
      onClick={ask}
      disabled={loading}
      title={`${semTags.length} sem tags · taggea até 20 via IA`}
      style={{ padding: '4px 10px', fontSize: '0.82rem' }}
    >
      {loading ? '🤖 Taggeando…' : `🤖 Tagear ${Math.min(20, semTags.length)} sem tags`}
    </button>
  );
}
