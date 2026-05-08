'use client';

import { useState } from 'react';
import {
  getAIKey,
  getDefaultProvider,
  PROVIDER_LABELS,
} from '@/lib/ai-keys';
import { getActivePersonaPrompt, withPersona } from '@/lib/persona-active';
import { Modal } from './Modal';
import { toast } from './Toast';
import type { Question } from '@/lib/types';

/**
 * Botão "🌐 Traduzir" — útil pra preparação de provas internacionais
 * (Camões, FBI, ONU, embaixada, etc) ou pra estudar inglês jurídico.
 *
 * Output read-only — não salva no banco. Só pra leitura/cópia.
 */
type Lang = 'en' | 'es';

const LANG_NAME: Record<Lang, string> = { en: 'Inglês', es: 'Espanhol' };

export function AITranslateButton({ question }: { question: Question }) {
  const provider = getDefaultProvider();
  const [open, setOpen] = useState(false);
  const [lang, setLang] = useState<Lang>('en');
  const [text, setText] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (!provider) return null;

  const ask = async () => {
    const apiKey = getAIKey(provider);
    if (!apiKey) {
      toast('Sem chave', 'error');
      return;
    }
    setLoading(true);
    setText('');

    const p = question.payload as {
      enunciado?: string;
      alternativas?: Array<{ letra: string; texto: string; correta?: boolean }>;
      frente?: string;
      verso?: string;
    };
    const ctx = [
      p.enunciado ?? p.frente ?? '',
      ...(p.alternativas ?? []).map((a) => `${a.letra}) ${a.texto}`),
      p.verso ?? '',
    ]
      .filter(Boolean)
      .join('\n');

    const promptBase = `Translate the following Brazilian Portuguese text to ${LANG_NAME[lang]} (${lang}). Keep formatting (alternatives stay as A) B) etc). No comments, just the translation:

${ctx.slice(0, 3000)}`;

    const personaPrompt = await getActivePersonaPrompt();
    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider,
          apiKey,
          prompt: withPersona(promptBase, personaPrompt),
          kind: 'translate',
          cacheable: !personaPrompt,
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
        className="ghost"
        onClick={() => setOpen(true)}
        title={`Traduzir via ${PROVIDER_LABELS[provider]}`}
        style={{ padding: '6px 12px', fontSize: '0.85rem', marginTop: 8 }}
      >
        🌐 Traduzir
      </button>
      {open && (
        <Modal onClose={() => setOpen(false)} ariaLabel="Tradução IA" maxWidth="640px">
          <div style={{ padding: 14 }}>
            <h3 style={{ margin: '0 0 12px' }}>🌐 Traduzir questão</h3>
            <div className="row gap" style={{ marginBottom: 12 }}>
              <label>
                <input
                  type="radio"
                  name="lang"
                  checked={lang === 'en'}
                  onChange={() => setLang('en')}
                />{' '}
                Inglês
              </label>
              <label>
                <input
                  type="radio"
                  name="lang"
                  checked={lang === 'es'}
                  onChange={() => setLang('es')}
                />{' '}
                Espanhol
              </label>
              <button
                type="button"
                className="primary"
                onClick={ask}
                disabled={loading}
                style={{ marginLeft: 'auto' }}
              >
                {loading ? 'Traduzindo…' : 'Traduzir'}
              </button>
            </div>
            {text && (
              <div
                style={{
                  whiteSpace: 'pre-wrap',
                  padding: 12,
                  background: 'var(--bg-elev-2)',
                  borderRadius: 'var(--radius)',
                  fontSize: '0.92rem',
                  lineHeight: 1.55,
                  maxHeight: '50vh',
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
