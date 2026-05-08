'use client';

import { useState } from 'react';
import {
  getAIKey,
  getDefaultProvider,
} from '@/lib/ai-keys';
import { getActivePersonaPrompt, withPersona } from '@/lib/persona-active';
import { canonicalTag, allKnownTags } from '@/lib/tag-dictionary';
import { toast } from './Toast';
import type { Question } from '@/lib/types';

/**
 * Pede pra IA sugerir 3-5 tags canonicais pra questão. User aceita
 * via callback (caller agrega no input de tags).
 */
export function AISuggestTagsButton({
  question,
  onSuggest,
}: {
  question: Question;
  onSuggest: (tags: string[]) => void;
}) {
  const provider = getDefaultProvider();
  const [loading, setLoading] = useState(false);

  if (!provider) return null;

  const ask = async () => {
    const apiKey = getAIKey(provider);
    if (!apiKey) {
      toast('Sem chave', 'error');
      return;
    }
    setLoading(true);
    try {
      const p = question.payload as {
        enunciado?: string;
        explicacao_geral?: string;
        frente?: string;
      };
      const ctx =
        (p.enunciado ?? p.frente ?? '') +
        '\n' +
        (p.explicacao_geral ?? '');

      const known = allKnownTags()
        .map((t) => t.canonical)
        .slice(0, 50)
        .join(', ');

      const promptBase = `Sugira 3-5 tags pra esta questão de concurso. Use SLUGS kebab-case (sem espaço, sem acento).

Tags conhecidas que você pode usar (ou criar novas no mesmo padrão): ${known}

Questão:
${ctx.slice(0, 1500)}

Responda APENAS com JSON: {"tags":["tag1","tag2","tag3"]}.
Tags devem ser específicas e úteis pra busca.`;

      const personaPrompt = await getActivePersonaPrompt();
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider,
          apiKey,
          prompt: withPersona(promptBase, personaPrompt),
          kind: 'suggest-tags',
          cacheable: !personaPrompt,
        }),
      });
      const j = await res.json().catch(() => null);
      if (!res.ok) {
        toast(j?.message ?? `Erro (${res.status})`, 'error');
        return;
      }
      const t = (j as { text: string }).text ?? '';
      const m = t.match(/\{[\s\S]*\}/);
      if (!m) {
        toast('Resposta IA inválida', 'warn');
        return;
      }
      const parsed = JSON.parse(m[0]);
      if (!Array.isArray(parsed.tags)) {
        toast('Resposta IA inválida', 'warn');
        return;
      }
      const cleaned: string[] = parsed.tags
        .filter((x: unknown): x is string => typeof x === 'string')
        .map((x: string) => canonicalTag(x))
        .filter((x: string) => !!x)
        .slice(0, 6);
      if (cleaned.length === 0) {
        toast('Nada pra sugerir', 'warn');
        return;
      }
      onSuggest(cleaned);
      toast(`${cleaned.length} tag(s) sugeridas`, 'success');
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
      onClick={ask}
      disabled={loading}
      title="Pede pra IA sugerir tags"
      style={{ padding: '4px 10px', fontSize: '0.78rem' }}
    >
      {loading ? '🤖 Pensando…' : '🤖 Sugerir tags'}
    </button>
  );
}
