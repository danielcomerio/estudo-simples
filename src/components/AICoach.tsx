'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { selectActiveQuestions, useStore } from '@/lib/store';
import { useActiveConcursoId } from '@/lib/settings';
import { useConcursos } from '@/lib/hierarchy';
import {
  getAIKey,
  getDefaultProvider,
  PROVIDER_LABELS,
} from '@/lib/ai-keys';
import { streamAIChat } from '@/lib/ai-stream';
import {
  buildCoachPrompt,
  buildUserContext,
  clearCoachHistory,
  DEFAULT_COACH_PROMPT,
  getCoachHistory,
  saveCoachHistory,
  type CoachMessage,
} from '@/lib/ai-coach';
import { MicButton } from './MicButton';
import { TTSButton } from './TTSButton';

type Persona = {
  id: string;
  name: string;
  emoji: string;
  system_prompt: string;
  concurso_id: string | null;
  preferred_provider?: string | null;
};

/**
 * AI Coach — botão flutuante (FAB) que abre painel de chat com contexto
 * do user (concurso, disciplinas fracas, etc). Persona ativa pode ser
 * customizada via /configuracoes.
 *
 * - Mounted no layout root (esconde se sem chave de IA — link discreto).
 * - FAB no canto inferior direito (acima do bottom nav mobile).
 * - Click abre painel modal portal (escapa stacking context).
 */
export function AICoach() {
  const [open, setOpen] = useState(false);
  const provider = getDefaultProvider();
  const hydrated = useStore((s) => s.hydrated);

  // Não renderiza FAB se user não tem chave configurada — coach
  // sem IA é só ruído visual.
  if (!provider || !hydrated) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="Abrir AI Coach"
        aria-label="Abrir AI Coach"
        className="ai-coach-fab"
      >
        🤖
      </button>
      {open && <CoachPanel onClose={() => setOpen(false)} />}
    </>
  );
}

function CoachPanel({ onClose }: { onClose: () => void }) {
  const provider = getDefaultProvider();
  const questions = useStore(selectActiveQuestions);
  const activeConcursoId = useActiveConcursoId();
  const { data: concursos } = useConcursos();

  const [messages, setMessages] = useState<CoachMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(false);
  const [streamingText, setStreamingText] = useState('');
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [activePersonaId, setActivePersonaId] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  // Lock body scroll
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  useEffect(() => {
    setMessages(getCoachHistory());
    fetch('/api/personas')
      .then((r) => r.json())
      .then((j: { items: Persona[] }) => {
        setPersonas(j.items ?? []);
      })
      .catch(() => {
        /* ignore */
      });
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, streamingText]);

  // Persona ativa: prefere persona vinculada ao concurso ativo, ou primeira global
  const activePersona =
    personas.find((p) => p.id === activePersonaId) ??
    personas.find((p) => p.concurso_id === activeConcursoId) ??
    personas.find((p) => p.concurso_id === null) ??
    null;

  const concursoNome =
    concursos?.find((c) => c.id === activeConcursoId)?.nome ?? null;

  function send() {
    if (!provider) return;
    const text = draft.trim();
    if (!text || loading) return;

    const userMsg: CoachMessage = {
      role: 'user',
      content: text,
      timestamp: Date.now(),
    };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    saveCoachHistory(newMessages);
    setDraft('');
    setStreamingText('');
    setLoading(true);

    const apiKey = getAIKey(provider);
    if (!apiKey) {
      setLoading(false);
      return;
    }

    const systemPrompt = activePersona?.system_prompt ?? DEFAULT_COACH_PROMPT;
    const ctx = buildUserContext(questions, concursoNome);
    const fullPrompt = buildCoachPrompt(systemPrompt, ctx, newMessages);

    let buffer = '';
    abortRef.current?.abort();
    abortRef.current = streamAIChat(
      {
        provider:
          (activePersona?.preferred_provider as 'openai') ?? provider,
        apiKey,
        prompt: fullPrompt,
        kind: 'coach',
      },
      {
        onChunk: (chunk) => {
          buffer += chunk;
          setStreamingText(buffer);
        },
        onDone: () => {
          if (buffer.trim()) {
            const assistantMsg: CoachMessage = {
              role: 'assistant',
              content: buffer.trim(),
              timestamp: Date.now(),
            };
            const final = [...newMessages, assistantMsg];
            setMessages(final);
            saveCoachHistory(final);
          }
          setStreamingText('');
          setLoading(false);
        },
        onError: (msg) => {
          setStreamingText(`⚠ ${msg}`);
          setLoading(false);
        },
      }
    );
  }

  function stop() {
    abortRef.current?.abort();
    abortRef.current = null;
    setStreamingText('');
    setLoading(false);
  }

  function clearAll() {
    if (!confirm('Limpar todo o histórico do coach?')) return;
    clearCoachHistory();
    setMessages([]);
    setStreamingText('');
  }

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal
      aria-label="AI Coach"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.5)',
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-end',
        alignItems: 'center',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--bg)',
          borderTopLeftRadius: 16,
          borderTopRightRadius: 16,
          width: '100%',
          maxWidth: 600,
          height: '85vh',
          maxHeight: '85vh',
          display: 'flex',
          flexDirection: 'column',
          border: '1px solid var(--border)',
          boxShadow: '0 -4px 24px rgba(0,0,0,0.3)',
        }}
      >
        {/* Header */}
        <div
          className="row between"
          style={{
            padding: '12px 16px',
            borderBottom: '1px solid var(--border)',
            alignItems: 'center',
          }}
        >
          <div>
            <strong style={{ fontSize: '1rem' }}>
              {activePersona?.emoji ?? '🤖'}{' '}
              {activePersona?.name ?? 'AI Coach'}
            </strong>
            <div className="muted" style={{ fontSize: '0.74rem' }}>
              {provider && PROVIDER_LABELS[provider]}
              {concursoNome && ` · ${concursoNome}`}
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Fechar"
            style={{ padding: '4px 10px', fontSize: '1rem' }}
          >
            ✕
          </button>
        </div>

        {/* Persona selector */}
        {personas.length > 0 && (
          <div
            style={{
              padding: '6px 16px',
              borderBottom: '1px solid var(--border)',
              background: 'var(--bg-elev-2)',
              display: 'flex',
              gap: 6,
              flexWrap: 'wrap',
              fontSize: '0.78rem',
              alignItems: 'center',
            }}
          >
            <span className="muted">Persona:</span>
            <button
              type="button"
              className={!activePersonaId ? 'primary' : 'ghost'}
              onClick={() => setActivePersonaId(null)}
              style={{ padding: '2px 8px', fontSize: '0.78rem' }}
            >
              🤖 Padrão
            </button>
            {personas.map((p) => (
              <button
                key={p.id}
                type="button"
                className={activePersonaId === p.id ? 'primary' : 'ghost'}
                onClick={() => setActivePersonaId(p.id)}
                style={{ padding: '2px 8px', fontSize: '0.78rem' }}
              >
                {p.emoji} {p.name}
              </button>
            ))}
          </div>
        )}

        {/* Messages */}
        <div
          ref={scrollRef}
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: 14,
          }}
        >
          {messages.length === 0 && !streamingText && (
            <div
              className="muted"
              style={{ textAlign: 'center', padding: 30, fontSize: '0.9rem' }}
            >
              Pergunte algo. Eu conheço seu banco, suas disciplinas fracas e
              questões inimigas.
              <br />
              <br />
              <em>Ex: "qual conteúdo eu mais preciso revisar essa semana?"</em>
              {personas.length === 0 && (
                <div style={{ marginTop: 16 }}>
                  <Link
                    href="/configuracoes#personas"
                    style={{
                      color: 'var(--primary)',
                      textDecoration: 'underline',
                    }}
                  >
                    🎭 Crie personas customizadas
                  </Link>
                </div>
              )}
            </div>
          )}
          {messages.map((m, i) => (
            <Bubble key={i} message={m} />
          ))}
          {streamingText && (
            <Bubble
              message={{
                role: 'assistant',
                content: streamingText,
                timestamp: Date.now(),
              }}
              streaming
            />
          )}
        </div>

        {/* Input */}
        <div
          style={{
            padding: 12,
            borderTop: '1px solid var(--border)',
            display: 'flex',
            gap: 6,
          }}
        >
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value.slice(0, 2000))}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                send();
              }
            }}
            placeholder="Pergunte algo… (Ctrl+Enter envia)"
            rows={2}
            maxLength={2000}
            style={{
              flex: 1,
              fontFamily: 'inherit',
              fontSize: '0.88rem',
              resize: 'vertical',
            }}
          />
          <MicButton
            onTranscript={(text) =>
              setDraft((cur) => (cur ? `${cur} ${text}` : text).slice(0, 2000))
            }
            title="Ditar pergunta"
          />
          {!loading ? (
            <button
              type="button"
              onClick={send}
              disabled={!draft.trim()}
              className="primary"
              style={{ padding: '6px 14px', alignSelf: 'flex-end' }}
            >
              Enviar
            </button>
          ) : (
            <button
              type="button"
              onClick={stop}
              style={{ padding: '6px 14px', alignSelf: 'flex-end' }}
            >
              ⏹
            </button>
          )}
        </div>

        <div
          style={{
            padding: '4px 12px 8px',
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: '0.7rem',
          }}
        >
          <Link href="/configuracoes#personas" className="muted">
            🎭 Personas
          </Link>
          {messages.length > 0 && (
            <button
              type="button"
              onClick={clearAll}
              className="ghost"
              style={{ padding: '0 6px', fontSize: '0.7rem' }}
            >
              🗑 Limpar
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}

function Bubble({
  message,
  streaming,
}: {
  message: CoachMessage;
  streaming?: boolean;
}) {
  const isUser = message.role === 'user';
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: isUser ? 'flex-end' : 'flex-start',
        marginBottom: 10,
      }}
    >
      <div
        style={{
          maxWidth: '85%',
          padding: '8px 12px',
          borderRadius: 12,
          background: isUser ? 'var(--primary)' : 'var(--bg-elev-2)',
          color: isUser ? '#fff' : 'var(--text)',
          border: isUser ? 'none' : '1px solid var(--border)',
          fontSize: '0.9rem',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
        }}
      >
        {message.content}
        {streaming && <span style={{ opacity: 0.5 }}>▊</span>}
      </div>
      {!isUser && !streaming && message.content.length > 20 && (
        <div style={{ marginTop: 4 }}>
          <TTSButton text={message.content} size="small" />
        </div>
      )}
    </div>
  );
}
