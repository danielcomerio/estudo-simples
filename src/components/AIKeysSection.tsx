'use client';

import { useEffect, useState } from 'react';
import {
  PROVIDER_LABELS,
  getAIKey,
  maskKey,
  setAIKey,
  type AIProvider,
} from '@/lib/ai-keys';
import { toast } from './Toast';

/**
 * Settings → "Conexão com IAs" — usuário pluga sua própria chave
 * OpenAI/Anthropic/Gemini. Storage: localStorage (não sincroniza —
 * chave é por-device).
 *
 * Habilita botão "🤖 Explicar" em questões erradas (não implementado
 * ainda nesta sessão — infra prep).
 */
const PROVIDERS: AIProvider[] = ['anthropic', 'openai', 'gemini'];

export function AIKeysSection() {
  const [keys, setKeys] = useState<Record<AIProvider, string>>({
    anthropic: '',
    openai: '',
    gemini: '',
  });
  const [editing, setEditing] = useState<AIProvider | null>(null);
  const [editValue, setEditValue] = useState('');

  useEffect(() => {
    setKeys({
      anthropic: getAIKey('anthropic') ?? '',
      openai: getAIKey('openai') ?? '',
      gemini: getAIKey('gemini') ?? '',
    });
  }, []);

  const save = (provider: AIProvider) => {
    try {
      setAIKey(provider, editValue);
      setKeys((k) => ({ ...k, [provider]: editValue }));
      setEditing(null);
      setEditValue('');
      toast(`Chave ${PROVIDER_LABELS[provider]} salva.`, 'success');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Erro', 'error');
    }
  };

  const remove = (provider: AIProvider) => {
    setAIKey(provider, null);
    setKeys((k) => ({ ...k, [provider]: '' }));
    toast(`Chave ${PROVIDER_LABELS[provider]} removida.`, 'success');
  };

  return (
    <div className="card" id="ai-keys">
      <h2 style={{ margin: '0 0 8px' }}>🤖 Conexão com IAs (BYO key)</h2>
      <p className="muted" style={{ margin: 0, fontSize: '0.9rem' }}>
        Pluga sua chave de API. App usa pra explicar questões erradas
        e ajudar com estudos. <strong>Você paga direto pro provider</strong>{' '}
        (~centavos por uso). Chave salva só neste navegador, nunca
        enviada pro nosso server.
      </p>

      <ul
        style={{
          listStyle: 'none',
          padding: 0,
          margin: '14px 0 0',
        }}
      >
        {PROVIDERS.map((provider) => {
          const has = !!keys[provider];
          const isEditing = editing === provider;
          return (
            <li
              key={provider}
              style={{
                padding: '10px 0',
                borderTop: '1px solid var(--border)',
              }}
            >
              <div
                className="row between"
                style={{ alignItems: 'center', gap: 10, flexWrap: 'wrap' }}
              >
                <strong style={{ fontSize: '0.92rem' }}>
                  {PROVIDER_LABELS[provider]}
                </strong>
                {!isEditing && has && (
                  <code
                    style={{
                      fontSize: '0.8rem',
                      color: 'var(--muted)',
                      flex: 1,
                      minWidth: 100,
                    }}
                  >
                    {maskKey(keys[provider])}
                  </code>
                )}
                <div className="row gap" style={{ alignItems: 'center' }}>
                  {!isEditing ? (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          setEditing(provider);
                          setEditValue('');
                        }}
                        style={{ padding: '4px 12px', fontSize: '0.85rem' }}
                      >
                        {has ? 'Trocar' : '+ Adicionar'}
                      </button>
                      {has && (
                        <button
                          type="button"
                          className="ghost"
                          onClick={() => remove(provider)}
                          style={{ padding: '4px 8px', fontSize: '0.85rem' }}
                        >
                          Remover
                        </button>
                      )}
                    </>
                  ) : (
                    <>
                      <input
                        type="password"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        placeholder="Cole a chave aqui"
                        autoFocus
                        style={{ minWidth: 200, fontSize: '0.85rem' }}
                        aria-label={`Chave ${PROVIDER_LABELS[provider]}`}
                      />
                      <button
                        type="button"
                        className="primary"
                        onClick={() => save(provider)}
                        disabled={!editValue.trim()}
                        style={{ padding: '4px 12px', fontSize: '0.85rem' }}
                      >
                        Salvar
                      </button>
                      <button
                        type="button"
                        className="ghost"
                        onClick={() => {
                          setEditing(null);
                          setEditValue('');
                        }}
                        style={{ padding: '4px 8px', fontSize: '0.85rem' }}
                      >
                        Cancelar
                      </button>
                    </>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      <p
        className="muted"
        style={{
          marginTop: 14,
          fontSize: '0.78rem',
          padding: '8px 12px',
          background: 'var(--bg-elev-2)',
          borderRadius: 'var(--radius)',
        }}
      >
        💡 Como pegar:
        <br />
        • <strong>Anthropic Claude</strong>: console.anthropic.com → API Keys
        <br />
        • <strong>OpenAI</strong>: platform.openai.com → API keys
        <br />
        • <strong>Google Gemini</strong>: aistudio.google.com → Get API key
      </p>
    </div>
  );
}
