'use client';

import { useState } from 'react';
import {
  getAIKey,
  getDefaultProvider,
} from '@/lib/ai-keys';
import { getActivePersonaPrompt, withPersona } from '@/lib/persona-active';
import { selectActiveQuestions, useStore, updateQuestionLocal } from '@/lib/store';
import { scheduleSync } from '@/lib/sync';
import { confirmDialog } from './ConfirmDialog';
import { toast } from './Toast';
import type { Question } from '@/lib/types';

/**
 * Bulk-validate de questões IA-geradas: pega até 20 com tag
 * gabarito-ia + verificacao=pendente, pede IA pra avaliar qualidade,
 * marca:
 *   score >= 7 → verificacao = 'verificada'
 *   score 4-6  → mantém pendente (preserva pra revisão manual)
 *   score <4   → verificacao = 'duvidosa'
 *
 * Persiste payload.ai_quality em todas pra rastreio.
 */

function buildPrompt(q: Question): string {
  const p = q.payload as {
    enunciado?: string;
    alternativas?: Array<{ letra: string; texto: string; correta?: boolean }>;
    gabarito?: string;
    explicacao_geral?: string;
  };
  const lines: string[] = [
    'Avalie qualidade técnica desta questão de concurso (gabarito gerado por IA, pode ter erros).',
    '',
    `ENUNCIADO: ${p.enunciado ?? ''}`,
  ];
  if (Array.isArray(p.alternativas)) {
    lines.push('', 'ALTERNATIVAS:');
    for (const a of p.alternativas) {
      lines.push(`${a.letra}) ${a.texto}${a.correta ? ' [GABARITO]' : ''}`);
    }
  }
  if (p.gabarito) lines.push('', `GABARITO: ${p.gabarito}`);
  if (p.explicacao_geral) {
    lines.push('', `EXPLICAÇÃO: ${p.explicacao_geral}`);
  }
  lines.push(
    '',
    'Responda APENAS JSON: {"score":<0-10>,"flags":[<0+>],"justificativa":"<até 100 chars>"}',
    '',
    'Score: 10=exemplar, 7-9=boa, 4-6=defeitos, 0-3=problemática (gabarito errado, ambígua, fora escopo).'
  );
  return lines.join('\n');
}

function parseQuality(text: string): { score: number; flags: string[]; justificativa: string } | null {
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try {
    const j = JSON.parse(m[0]);
    if (
      typeof j.score === 'number' &&
      Array.isArray(j.flags) &&
      typeof j.justificativa === 'string'
    ) {
      return {
        score: Math.max(0, Math.min(10, Math.round(j.score * 10) / 10)),
        flags: j.flags.filter((f: unknown): f is string => typeof f === 'string').slice(0, 5),
        justificativa: j.justificativa.slice(0, 200),
      };
    }
  } catch {
    /* ignore */
  }
  return null;
}

export function AIBulkValidateButton() {
  const provider = getDefaultProvider();
  const all = useStore(selectActiveQuestions);
  const [loading, setLoading] = useState(false);

  if (!provider) return null;

  const candidates = all.filter(
    (q) =>
      q.verificacao === 'pendente' &&
      ((q.tags ?? []).includes('gabarito-ia') ||
        (q.fonte as { gabarito_source?: string } | undefined)?.gabarito_source === 'ia')
  );
  if (candidates.length === 0) return null;

  const ask = async () => {
    const target = candidates.slice(0, 20);
    const ok = await confirmDialog({
      title: 'Validar gabaritos IA em lote',
      message: `${target.length} questão(ões) com tag gabarito-ia + verificação pendente. IA vai avaliar cada uma e auto-marcar:
• Score ≥7 → verificada
• Score 4-6 → pendente (manual)
• Score <4 → duvidosa

Custa ~${target.length} chamadas IA. Continuar?`,
      danger: false,
    });
    if (!ok) return;

    const apiKey = getAIKey(provider);
    if (!apiKey) {
      toast('Sem chave', 'error');
      return;
    }
    setLoading(true);
    let verificadas = 0;
    let duvidosas = 0;
    let mantidas = 0;
    let falhas = 0;
    const personaPrompt = await getActivePersonaPrompt();

    for (const q of target) {
      try {
        const res = await fetch('/api/ai/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            provider,
            apiKey,
            prompt: withPersona(buildPrompt(q), personaPrompt),
            kind: 'bulk-validate',
            cacheable: !personaPrompt,
          }),
        });
        if (!res.ok) {
          falhas++;
          continue;
        }
        const j = (await res.json()) as { text: string };
        const parsed = parseQuality(j.text ?? '');
        if (!parsed) {
          falhas++;
          continue;
        }
        const newVerif: 'verificada' | 'pendente' | 'duvidosa' =
          parsed.score >= 7 ? 'verificada' : parsed.score < 4 ? 'duvidosa' : 'pendente';
        updateQuestionLocal(q.id, (cur) => ({
          verificacao: newVerif,
          payload: {
            ...cur.payload,
            ai_quality: {
              ...parsed,
              evaluatedAt: Date.now(),
              provider,
            },
          },
        }));
        if (newVerif === 'verificada') verificadas++;
        else if (newVerif === 'duvidosa') duvidosas++;
        else mantidas++;
      } catch {
        falhas++;
      }
    }
    scheduleSync();
    setLoading(false);
    toast(
      `✅ ${verificadas} verificadas · ⚠ ${duvidosas} duvidosas · 🟡 ${mantidas} pendentes · ${falhas} falhas`,
      verificadas > 0 ? 'success' : 'warn'
    );
  };

  return (
    <button
      type="button"
      onClick={ask}
      disabled={loading}
      title={`${candidates.length} pendentes IA · valida até 20`}
      style={{ padding: '4px 10px', fontSize: '0.82rem' }}
    >
      {loading ? '🤖 Validando…' : `🤖 Validar ${Math.min(20, candidates.length)} gabaritos IA`}
    </button>
  );
}
