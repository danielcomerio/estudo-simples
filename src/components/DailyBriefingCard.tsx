'use client';

import { useEffect, useRef, useState } from 'react';
import { selectActiveQuestions, useStore } from '@/lib/store';
import {
  getAIKey,
  getDefaultProvider,
  PROVIDER_LABELS,
} from '@/lib/ai-keys';
import { streamAIChat } from '@/lib/ai-stream';
import { getActivePersonaPrompt, withPersona } from '@/lib/persona-active';
import { isOverdue } from '@/lib/srs';

const STORAGE_KEY = 'estudo-simples:daily-briefing:v1';
const ENABLED_KEY = 'estudo-simples:daily-briefing-enabled';

type Cached = {
  date: string;
  text: string;
  provider: string;
};

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function readCache(): Cached | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const j = JSON.parse(raw) as Cached;
    if (j.date !== todayKey()) return null;
    return j;
  } catch {
    return null;
  }
}

function writeCache(c: Cached) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(c));
  } catch {
    /* ignore */
  }
}

function isEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(ENABLED_KEY) === '1';
}

function setEnabled(v: boolean) {
  if (v) localStorage.setItem(ENABLED_KEY, '1');
  else localStorage.removeItem(ENABLED_KEY);
}

/**
 * Card "🤖 Briefing de hoje" no Painel. Gera 3-4 linhas resumindo:
 * - quantas vencidas tem agora,
 * - 1 disciplina fraca pra focar (menor % acerto, mín 3 tentativas),
 * - sugestão concreta de modo (SRS / inimigas).
 *
 * Opt-in (botão "ativar"). Cache 1x/dia em localStorage. BYO key —
 * usa chave default do user.
 */
export function DailyBriefingCard() {
  const questions = useStore(selectActiveQuestions);
  const [enabled, setEnabledState] = useState(false);
  const [text, setText] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const triggeredRef = useRef(false);
  const provider = getDefaultProvider();

  useEffect(() => {
    setEnabledState(isEnabled());
    const c = readCache();
    if (c) setText(c.text);
  }, []);

  useEffect(() => {
    if (!enabled || triggeredRef.current) return;
    if (text) return; // já tem cache de hoje
    if (!provider) return;
    if (questions.length === 0) return;
    triggeredRef.current = true;
    void generate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, provider, questions.length]);

  async function generate() {
    if (!provider) return;
    const apiKey = getAIKey(provider);
    if (!apiKey) {
      setError('Sem chave configurada');
      return;
    }
    setLoading(true);
    setError(null);
    setText('');

    // Calcula stats compactas
    const nowMs = Date.now();
    let vencidas = 0;
    let novas = 0;
    type Bucket = { tentativas: number; acertos: number };
    const byDisc = new Map<string, Bucket>();
    for (const q of questions) {
      if (isOverdue(q.srs, nowMs)) vencidas++;
      if ((q.srs?.repetitions ?? 0) === 0) novas++;
      const t = q.stats?.attempts ?? 0;
      const a = q.stats?.correct ?? 0;
      const d = q.disciplina_id || 'sem-disciplina';
      const b = byDisc.get(d) ?? { tentativas: 0, acertos: 0 };
      b.tentativas += t;
      b.acertos += a;
      byDisc.set(d, b);
    }
    const fracas = Array.from(byDisc.entries())
      .filter(([, b]) => b.tentativas >= 3)
      .map(([d, b]) => ({ d, pct: b.acertos / b.tentativas }))
      .sort((a, b) => a.pct - b.pct)
      .slice(0, 3);

    const ctxLines = [
      `Total de questões no banco: ${questions.length}`,
      `Vencidas/hoje: ${vencidas}`,
      `Novas (não estudadas): ${novas}`,
    ];
    if (fracas.length > 0) {
      ctxLines.push(
        `Disciplinas mais fracas: ${fracas
          .map((f) => `${f.d} (${Math.round(f.pct * 100)}%)`)
          .join(', ')}`
      );
    }

    const promptBase = `Você é um coach de concursos. Escreva um BRIEFING MATINAL curto e específico (3-4 linhas, max 80 palavras) pro estudante.

Estado atual:
${ctxLines.join('\n')}

Inclua:
- 1 frase de motivação contextual (não-genérica),
- ação concreta de hoje (qual modo / quantas questões / qual disciplina),
- tom direto, pt-BR, sem emojis em excesso (1 max).

Não use markdown. Não cumprimente. Vá direto.`;

    const personaPrompt = await getActivePersonaPrompt();
    streamAIChat(
      {
        provider,
        apiKey,
        prompt: withPersona(promptBase, personaPrompt),
        kind: 'briefing',
      },
      {
        onChunk: (chunk) => setText((cur) => (cur ?? '') + chunk),
        onDone: () => {
          setLoading(false);
          // Persist cache uma vez no fim
          setText((cur) => {
            if (cur) writeCache({ date: todayKey(), text: cur, provider });
            return cur;
          });
        },
        onError: (msg) => {
          setError(msg);
          setLoading(false);
        },
      }
    );
  }

  // Caso 1: não habilitado — mostra opt-in
  if (!enabled) {
    if (!provider) return null;
    return (
      <div
        className="card"
        style={{ padding: 14, fontSize: '0.9rem', display: 'flex', gap: 10, alignItems: 'center' }}
      >
        <span aria-hidden style={{ fontSize: '1.4rem' }}>🤖</span>
        <div style={{ flex: 1 }}>
          <strong>Briefing de IA matinal</strong>
          <div className="muted" style={{ fontSize: '0.85rem' }}>
            Resumo personalizado do que estudar hoje. Usa sua chave BYO,
            roda 1x/dia.
          </div>
        </div>
        <button
          type="button"
          className="primary"
          onClick={() => {
            setEnabled(true);
            setEnabledState(true);
          }}
        >
          Ativar
        </button>
      </div>
    );
  }

  // Caso 2: habilitado, sem provider
  if (!provider) {
    return (
      <div className="card" style={{ padding: 12, fontSize: '0.88rem' }}>
        🤖 Briefing aguardando chave de IA. Configure em /configuracoes.
      </div>
    );
  }

  // Caso 3: habilitado e gerando/gerado
  return (
    <div
      className="card"
      style={{
        padding: 14,
        borderLeft: '3px solid var(--primary)',
        fontSize: '0.92rem',
      }}
    >
      <div className="row gap" style={{ alignItems: 'center', marginBottom: 6 }}>
        <strong>🤖 Briefing de hoje</strong>
        <span className="muted" style={{ fontSize: '0.78rem' }}>
          via {PROVIDER_LABELS[provider]}
        </span>
        <span style={{ flex: 1 }} />
        <button
          type="button"
          className="ghost"
          onClick={() => {
            triggeredRef.current = false;
            setText(null);
            try {
              localStorage.removeItem(STORAGE_KEY);
            } catch {}
            void generate();
          }}
          disabled={loading}
          style={{ padding: '2px 8px', fontSize: '0.78rem' }}
        >
          {loading ? 'Pensando…' : '↻ Gerar'}
        </button>
        <button
          type="button"
          className="ghost"
          onClick={() => {
            setEnabled(false);
            setEnabledState(false);
          }}
          style={{ padding: '2px 8px', fontSize: '0.78rem' }}
          title="Desativar briefing"
        >
          ✕
        </button>
      </div>
      {error && (
        <p className="muted" style={{ fontSize: '0.82rem', color: 'var(--danger)' }}>
          ⚠ {error}
        </p>
      )}
      {!text && !loading && !error && (
        <p className="muted" style={{ fontSize: '0.85rem' }}>
          Sem briefing ainda — clique em ↻.
        </p>
      )}
      {text && (
        <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>{text}</div>
      )}
    </div>
  );
}
