'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  getAIKey,
  getDefaultProvider,
  PROVIDER_LABELS,
} from '@/lib/ai-keys';
import { streamAIChat } from '@/lib/ai-stream';
import { getActivePersonaPrompt, withPersona } from '@/lib/persona-active';

/**
 * Botão "🤖 Explicar" — só aparece se user configurou ao menos uma
 * chave em /configuracoes (BYO key model).
 *
 * Pega a chave da ai-keys lib (localStorage), monta prompt explicando
 * a questão errada, chama /api/ai/chat (proxy), mostra resposta inline.
 *
 * Sem chave: mostra link discreto pra /configuracoes.
 */
export function AIExplainButton({
  enunciado,
  alternativaCorreta,
  alternativaEscolhida,
  explicacaoOficial,
  autoTrigger,
}: {
  enunciado: string;
  alternativaCorreta?: string | null;
  alternativaEscolhida?: string | null;
  explicacaoOficial?: string | null;
  /** Quando true, dispara ask() automaticamente no primeiro mount.
   *  Usado pelo Live AI Tutor: explica sem o user clicar. */
  autoTrigger?: boolean;
}) {
  const provider = getDefaultProvider();
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!provider) {
    return (
      <Link
        href="/configuracoes"
        title="Configure uma chave de IA pra usar"
        style={{
          fontSize: '0.85rem',
          color: 'var(--muted)',
          textDecoration: 'underline',
        }}
      >
        🤖 Configurar IA pra explicar
      </Link>
    );
  }

  const buildPrompt = () => {
    const parts = [
      'Você é um professor especialista em concursos públicos brasileiros. O aluno respondeu uma questão. Explique de forma didática e curta (até 200 palavras) por que a resposta correta é a certa, abordando o conceito subjacente.',
      '',
      'QUESTÃO:',
      enunciado,
      '',
    ];
    if (alternativaCorreta) {
      parts.push(`Resposta correta: ${alternativaCorreta}`);
    }
    if (alternativaEscolhida && alternativaEscolhida !== alternativaCorreta) {
      parts.push(
        `O aluno escolheu: ${alternativaEscolhida} (errada). Aponte por que essa é uma pegadinha comum.`
      );
    }
    if (explicacaoOficial) {
      parts.push(
        '',
        'Explicação oficial existente (use de base mas reforce de forma diferente):',
        explicacaoOficial
      );
    }
    parts.push(
      '',
      'Resposta direta, sem floreio, em pt-BR. Use bullet points se ajudar a fixar.'
    );
    return parts.join('\n');
  };

  const abortRef = useRef<AbortController | null>(null);

  const ask = async () => {
    if (!provider) return;
    setLoading(true);
    setError(null);
    setResponse('');
    const apiKey = getAIKey(provider);
    if (!apiKey) {
      setError('Chave não encontrada. Configure em /configuracoes.');
      setLoading(false);
      return;
    }
    const personaPrompt = await getActivePersonaPrompt();
    abortRef.current?.abort();
    abortRef.current = streamAIChat(
      // cacheable: SÓ quando sem persona — persona muda o prompt e
      // tornaria o cache key user-specific demais (muito miss). Sem
      // persona, explicação é determinística e o cache compartilhado
      // economiza tokens entre users.
      {
        provider,
        apiKey,
        prompt: withPersona(buildPrompt(), personaPrompt),
        cacheable: !personaPrompt,
        kind: 'explain',
      },
      {
        onChunk: (chunk) => setResponse((prev) => (prev ?? '') + chunk),
        onDone: () => setLoading(false),
        onError: (msg) => {
          setError(msg);
          setLoading(false);
        },
      }
    );
  };

  const stop = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    setLoading(false);
  };

  const triggeredRef = useRef(false);
  useEffect(() => {
    if (!autoTrigger || triggeredRef.current) return;
    if (!provider) return;
    triggeredRef.current = true;
    ask();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoTrigger, provider]);

  return (
    <div style={{ marginTop: 10 }}>
      {!response && (
        <button
          type="button"
          onClick={ask}
          disabled={loading}
          title={`Pedir explicação via ${PROVIDER_LABELS[provider]}`}
          style={{ padding: '6px 12px', fontSize: '0.85rem' }}
        >
          {loading
            ? 'Pensando…'
            : `🤖 Explicar via ${provider === 'anthropic' ? 'Claude' : provider === 'openai' ? 'ChatGPT' : 'Gemini'}`}
        </button>
      )}
      {loading && response && (
        <button
          type="button"
          onClick={stop}
          className="ghost"
          style={{ padding: '4px 10px', fontSize: '0.78rem', marginLeft: 6 }}
        >
          ⏹ Parar
        </button>
      )}
      {error && (
        <p
          className="muted"
          style={{ fontSize: '0.82rem', color: 'var(--danger)', marginTop: 6 }}
        >
          ⚠ {error}
        </p>
      )}
      {response && (
        <div
          style={{
            marginTop: 8,
            padding: 12,
            background: 'var(--bg-elev-2)',
            borderRadius: 'var(--radius)',
            borderLeft: '3px solid var(--primary)',
            fontSize: '0.92rem',
            whiteSpace: 'pre-wrap',
            lineHeight: 1.5,
          }}
        >
          <div
            className="muted"
            style={{ fontSize: '0.78rem', marginBottom: 6 }}
          >
            🤖 {PROVIDER_LABELS[provider]}
          </div>
          {response}
          <button
            type="button"
            className="ghost"
            onClick={() => setResponse(null)}
            style={{
              padding: '2px 8px',
              fontSize: '0.78rem',
              marginTop: 8,
              display: 'block',
            }}
          >
            Pedir de novo
          </button>
        </div>
      )}
    </div>
  );
}
