'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  getAIKey,
  getDefaultProvider,
  PROVIDER_LABELS,
} from '@/lib/ai-keys';
import { streamAIChat } from '@/lib/ai-stream';
import {
  clearChatHistory,
  getChatHistory,
  historyToPrompt,
  saveChatHistory,
  type ChatMessage,
} from '@/lib/question-chat';
import { confirmDialog } from './ConfirmDialog';

/**
 * Painel de chat por questão. Persiste em localStorage por device.
 * Plugado no QuestionEditDrawer (collapsible).
 */
export function QuestionChatPanel({
  questionId,
  questionContext,
}: {
  questionId: string;
  /** Texto que dá contexto à IA (enunciado + alternativas + gabarito). */
  questionContext: string;
}) {
  const provider = getDefaultProvider();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(false);
  const [streamingText, setStreamingText] = useState('');
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setMessages(getChatHistory(questionId));
  }, [questionId]);

  // Auto-scroll quando mensagem nova
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, streamingText]);

  if (!provider) {
    return (
      <p style={{ fontSize: '0.85rem', margin: '8px 0' }}>
        <Link
          href="/configuracoes"
          style={{ color: 'var(--muted)', textDecoration: 'underline' }}
        >
          🤖 Configure uma chave de IA pra conversar sobre essa questão
        </Link>
      </p>
    );
  }

  function send() {
    const text = draft.trim();
    if (!text || loading) return;

    const userMsg: ChatMessage = {
      role: 'user',
      content: text,
      timestamp: Date.now(),
    };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    saveChatHistory(questionId, newMessages);
    setDraft('');
    setStreamingText('');
    setLoading(true);

    const apiKey = getAIKey(provider!);
    if (!apiKey) {
      setLoading(false);
      return;
    }

    let buffer = '';
    abortRef.current?.abort();
    abortRef.current = streamAIChat(
      {
        provider: provider!,
        apiKey,
        prompt: historyToPrompt(newMessages, questionContext),
        kind: 'chat',
        // cacheable: false — chat é multi-turn, não cacheable
      },
      {
        onChunk: (chunk) => {
          buffer += chunk;
          setStreamingText(buffer);
        },
        onDone: () => {
          if (buffer.trim()) {
            const assistantMsg: ChatMessage = {
              role: 'assistant',
              content: buffer.trim(),
              timestamp: Date.now(),
            };
            const final = [...newMessages, assistantMsg];
            setMessages(final);
            saveChatHistory(questionId, final);
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

  async function clearAll() {
    const ok = await confirmDialog({
      title: 'Limpar conversa?',
      message: `Vou apagar ${messages.length} mensagem(ns) deste chat. Não dá pra desfazer.`,
      danger: true,
    });
    if (!ok) return;
    clearChatHistory(questionId);
    setMessages([]);
    setStreamingText('');
  }

  return (
    <div style={{ marginTop: 8 }}>
      <div
        ref={scrollRef}
        style={{
          maxHeight: 320,
          overflowY: 'auto',
          padding: 10,
          background: 'var(--bg-elev-2)',
          borderRadius: 8,
          border: '1px solid var(--border)',
          marginBottom: 8,
        }}
      >
        {messages.length === 0 && !streamingText && (
          <p
            className="muted"
            style={{ fontSize: '0.82rem', margin: 0, textAlign: 'center' }}
          >
            Pergunte algo sobre essa questão. Conversa salva no seu device.
          </p>
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

      <div style={{ display: 'flex', gap: 6 }}>
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
        {!loading ? (
          <button
            type="button"
            onClick={send}
            disabled={!draft.trim()}
            style={{ padding: '6px 12px', alignSelf: 'flex-end' }}
          >
            Enviar
          </button>
        ) : (
          <button
            type="button"
            onClick={stop}
            className="ghost"
            style={{ padding: '6px 12px', alignSelf: 'flex-end' }}
          >
            ⏹ Parar
          </button>
        )}
      </div>

      <div
        className="row between"
        style={{ marginTop: 6, alignItems: 'center', flexWrap: 'wrap' }}
      >
        <span
          className="muted"
          style={{ fontSize: '0.74rem' }}
        >
          {messages.length} msg(s) · {PROVIDER_LABELS[provider]}
        </span>
        {messages.length > 0 && (
          <button
            type="button"
            onClick={clearAll}
            className="ghost"
            style={{ padding: '2px 8px', fontSize: '0.74rem' }}
          >
            🗑 Limpar
          </button>
        )}
      </div>
    </div>
  );
}

function Bubble({
  message,
  streaming,
}: {
  message: ChatMessage;
  streaming?: boolean;
}) {
  const isUser = message.role === 'user';
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: isUser ? 'flex-end' : 'flex-start',
        marginBottom: 8,
      }}
    >
      <div
        style={{
          maxWidth: '85%',
          padding: '6px 10px',
          borderRadius: 10,
          background: isUser ? 'var(--primary)' : 'var(--bg)',
          color: isUser ? '#fff' : 'var(--text)',
          border: isUser ? 'none' : '1px solid var(--border)',
          fontSize: '0.88rem',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
        }}
      >
        {message.content}
        {streaming && <span style={{ opacity: 0.5 }}>▊</span>}
      </div>
      {!streaming && (
        <span
          className="muted"
          style={{ fontSize: '0.7rem', marginTop: 2 }}
        >
          {new Date(message.timestamp).toLocaleTimeString('pt-BR', {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </span>
      )}
    </div>
  );
}
