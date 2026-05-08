'use client';

import { useState } from 'react';
import {
  getAIKey,
  getDefaultProvider,
  PROVIDER_LABELS,
} from '@/lib/ai-keys';
import { getActivePersonaPrompt, withPersona } from '@/lib/persona-active';
import { toast } from './Toast';
import type { Question } from '@/lib/types';
import { updateQuestionLocal } from '@/lib/store';
import { scheduleSync } from '@/lib/sync';

/**
 * Botão "🤖 Avaliar qualidade" que pede pra IA julgar a questão como
 * um corretor de banca avaliaria. Output: nota 0-10 + flags (ambígua,
 * 2-corretas-possíveis, gabarito errado, fora do escopo, etc) +
 * justificativa curta.
 *
 * Salva resultado em payload.ai_quality (gerenciado por updateQuestionLocal)
 * pra permitir filtros em /banco.
 */
type QualityResult = {
  score: number;
  flags: string[];
  justificativa: string;
  evaluatedAt: number;
  provider: string;
};

function buildPrompt(q: Question): string {
  const p = q.payload as { enunciado?: string; alternativas?: Array<{ letra: string; texto: string; correta?: boolean }>; gabarito?: string; explicacao_geral?: string };
  const lines: string[] = [
    'Você é um avaliador rigoroso de questões de concurso público brasileiro. Julgue a qualidade técnica e didática desta questão.',
    '',
    `ENUNCIADO: ${p.enunciado ?? ''}`,
  ];
  if (Array.isArray(p.alternativas) && p.alternativas.length > 0) {
    lines.push('', 'ALTERNATIVAS:');
    for (const a of p.alternativas) {
      lines.push(
        `${a.letra}) ${a.texto}${a.correta ? ' [GABARITO]' : ''}`
      );
    }
  }
  if (p.gabarito) lines.push('', `GABARITO: ${p.gabarito}`);
  if (p.explicacao_geral) {
    lines.push('', `EXPLICAÇÃO OFICIAL: ${p.explicacao_geral}`);
  }
  lines.push(
    '',
    'Responda APENAS com JSON válido neste formato:',
    '{"score": <0-10>, "flags": [<0+ flags da lista>], "justificativa": "<até 200 chars>"}',
    '',
    'Flags possíveis (use só as aplicáveis):',
    '- "ambigua" (mais de uma alternativa pode estar certa)',
    '- "gabarito_errado" (alternativa marcada não é a correta)',
    '- "enunciado_confuso" (texto unclear)',
    '- "fora_de_escopo" (não combina com disciplina alegada)',
    '- "desatualizada" (lei/jurisprudência mudou)',
    '- "trivial" (nivel muito fácil)',
    '- "boa" (sem problemas, didática)',
    '',
    'Score: 10 = exemplar, 7-9 = boa, 4-6 = ok com defeitos, 0-3 = problemática.'
  );
  return lines.join('\n');
}

function parseQualityJson(text: string): { score: number; flags: string[]; justificativa: string } | null {
  // Tenta extrair JSON de qualquer lugar do texto
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
        flags: j.flags.filter((f: unknown): f is string => typeof f === 'string').slice(0, 6),
        justificativa: j.justificativa.slice(0, 400),
      };
    }
  } catch {
    /* ignore */
  }
  return null;
}

export function AIQualityScoreButton({ question }: { question: Question }) {
  const provider = getDefaultProvider();
  const [loading, setLoading] = useState(false);

  const existing = (question.payload as { ai_quality?: QualityResult }).ai_quality;

  if (!provider) return null;

  const ask = async () => {
    const apiKey = getAIKey(provider);
    if (!apiKey) {
      toast('Chave IA não configurada', 'error');
      return;
    }
    setLoading(true);
    try {
      const personaPrompt = await getActivePersonaPrompt();
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider,
          apiKey,
          prompt: withPersona(buildPrompt(question), personaPrompt),
          kind: 'quality-score',
          cacheable: !personaPrompt,
        }),
      });
      const j = await res.json().catch(() => null);
      if (!res.ok) {
        toast(j?.message ?? `Erro (${res.status})`, 'error');
        setLoading(false);
        return;
      }
      const parsed = parseQualityJson((j as { text: string }).text);
      if (!parsed) {
        toast('Resposta IA inválida', 'error');
        setLoading(false);
        return;
      }
      const result: QualityResult = {
        ...parsed,
        evaluatedAt: Date.now(),
        provider,
      };
      updateQuestionLocal(question.id, (cur) => ({
        ...cur,
        payload: { ...cur.payload, ai_quality: result },
      }));
      scheduleSync();
      toast(
        `Qualidade: ${result.score}/10${result.flags.length ? ` · ${result.flags.join(', ')}` : ''}`,
        result.score >= 7 ? 'success' : result.score >= 4 ? 'warn' : 'error'
      );
    } catch (e) {
      toast(e instanceof Error ? e.message : 'erro', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ marginTop: 8 }}>
      <button
        type="button"
        onClick={ask}
        disabled={loading}
        title={`Pedir avaliação de qualidade via ${PROVIDER_LABELS[provider]}`}
        style={{ padding: '6px 12px', fontSize: '0.85rem' }}
      >
        {loading ? 'Avaliando…' : '🤖 Avaliar qualidade'}
      </button>
      {existing && (
        <div
          style={{
            marginTop: 6,
            padding: 8,
            background: 'var(--bg-elev-2)',
            borderRadius: 'var(--radius)',
            fontSize: '0.82rem',
          }}
        >
          <strong>{existing.score}/10</strong>{' '}
          {existing.flags.length > 0 && (
            <span className="muted">· {existing.flags.join(', ')}</span>
          )}
          <div style={{ marginTop: 4 }}>{existing.justificativa}</div>
        </div>
      )}
    </div>
  );
}
