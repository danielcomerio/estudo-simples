'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  getAIKey,
  getDefaultProvider,
  PROVIDER_LABELS,
} from '@/lib/ai-keys';
import { toast } from './Toast';

export type RewriteVariant =
  | 'paraphrase'
  | 'harder'
  | 'easier'
  | 'banca-style';

const PROMPTS: Record<RewriteVariant, (orig: string, banca?: string) => string> = {
  paraphrase: (orig) =>
    `Reescreva o enunciado abaixo mantendo EXATAMENTE o mesmo conceito sendo testado e o mesmo gabarito, apenas mudando palavras e estrutura pra evitar memorização literal. Não mude o sentido nem o nível de dificuldade. Responda APENAS com o novo enunciado, sem explicação.\n\nORIGINAL:\n${orig}\n\nNOVO ENUNCIADO:`,
  harder: (orig) =>
    `Aumente a dificuldade do enunciado abaixo. Pode adicionar pegadinhas conceituais, exigir aplicação ao invés de memorização, ou refinar o caso. Mantenha o tema e o gabarito implícito. Responda APENAS com o novo enunciado, sem explicação.\n\nORIGINAL:\n${orig}\n\nNOVO ENUNCIADO MAIS DIFÍCIL:`,
  easier: (orig) =>
    `Diminua a dificuldade do enunciado abaixo, mantendo o mesmo conceito. Use linguagem mais direta, remova pegadinhas. Mantenha o gabarito coerente. Responda APENAS com o novo enunciado.\n\nORIGINAL:\n${orig}\n\nNOVO ENUNCIADO MAIS FÁCIL:`,
  'banca-style': (orig, banca) =>
    `Reescreva o enunciado abaixo no estilo da banca ${banca ?? 'FGV'} (linguagem formal de concurso, frases longas, terminologia técnica). Mantenha o conceito e o gabarito. Responda APENAS com o novo enunciado.\n\nORIGINAL:\n${orig}\n\nNOVO ENUNCIADO ESTILO ${banca ?? 'FGV'}:`,
};

const VARIANT_LABELS: Record<RewriteVariant, string> = {
  paraphrase: '🔄 Parafrasear',
  harder: '📈 Aumentar dificuldade',
  easier: '📉 Diminuir dificuldade',
  'banca-style': '🎯 Estilo da banca',
};

/**
 * Botão "🤖 Reescrever" no QuestionEditDrawer. Click → menu de variantes
 * → chama IA → mostra novo enunciado em textarea com Aplicar/Cancelar.
 *
 * Sem chave: link discreto pra /configuracoes.
 */
export function AIRewriteButton({
  originalText,
  banca,
  onApply,
}: {
  originalText: string;
  banca?: string;
  onApply: (newText: string) => void;
}) {
  const provider = getDefaultProvider();
  const [open, setOpen] = useState(false);
  const [variant, setVariant] = useState<RewriteVariant | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState('');

  if (!provider) {
    return (
      <Link
        href="/configuracoes"
        title="Configure uma chave de IA"
        style={{
          fontSize: '0.78rem',
          color: 'var(--muted)',
          textDecoration: 'underline',
        }}
      >
        🤖 Configurar IA
      </Link>
    );
  }

  if (!originalText.trim()) return null;

  async function rewrite(v: RewriteVariant) {
    setVariant(v);
    setLoading(true);
    setResult('');
    const apiKey = getAIKey(provider!);
    if (!apiKey) {
      toast('Chave não configurada', 'error');
      setLoading(false);
      return;
    }
    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider,
          apiKey,
          prompt: PROMPTS[v](originalText, banca),
          kind: 'rewrite',
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        toast(json?.message ?? 'Erro do provider', 'error');
        setLoading(false);
        return;
      }
      setResult((json as { text: string }).text.trim());
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Erro', 'error');
    } finally {
      setLoading(false);
    }
  }

  function apply() {
    if (!result.trim()) return;
    onApply(result.trim());
    setOpen(false);
    setVariant(null);
    setResult('');
    toast('Enunciado atualizado. Salve a questão pra confirmar.', 'success');
  }

  function reset() {
    setVariant(null);
    setResult('');
  }

  return (
    <div style={{ marginTop: 6 }}>
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="ghost"
          style={{ padding: '4px 10px', fontSize: '0.78rem' }}
          title={`Reescrever via ${PROVIDER_LABELS[provider]}`}
        >
          🤖 Reescrever
        </button>
      )}

      {open && !variant && (
        <div
          style={{
            padding: 10,
            border: '1px solid var(--border)',
            borderRadius: 8,
            background: 'var(--bg-elev-2)',
            marginTop: 6,
          }}
        >
          <div style={{ fontSize: '0.82rem', marginBottom: 8 }}>
            Como reescrever?
          </div>
          <div className="row gap wrap">
            {(Object.keys(VARIANT_LABELS) as RewriteVariant[]).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => rewrite(v)}
                style={{ padding: '4px 10px', fontSize: '0.82rem' }}
              >
                {VARIANT_LABELS[v]}
              </button>
            ))}
            <button
              type="button"
              className="ghost"
              onClick={() => setOpen(false)}
              style={{ padding: '4px 10px', fontSize: '0.82rem' }}
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {open && variant && (
        <div
          style={{
            padding: 10,
            border: '1px solid var(--border)',
            borderRadius: 8,
            background: 'var(--bg-elev-2)',
            marginTop: 6,
          }}
        >
          <div className="row between" style={{ marginBottom: 6 }}>
            <strong style={{ fontSize: '0.85rem' }}>
              {VARIANT_LABELS[variant]}
            </strong>
            <button
              type="button"
              className="ghost"
              onClick={reset}
              style={{ padding: '2px 6px', fontSize: '0.75rem' }}
            >
              ← Outra opção
            </button>
          </div>

          {loading && (
            <p
              className="muted"
              style={{ fontSize: '0.85rem', textAlign: 'center', padding: 10 }}
            >
              Gerando…
            </p>
          )}

          {!loading && result && (
            <>
              <textarea
                value={result}
                onChange={(e) => setResult(e.target.value)}
                rows={6}
                style={{
                  width: '100%',
                  fontSize: '0.88rem',
                  fontFamily: 'inherit',
                  resize: 'vertical',
                }}
              />
              <div className="row gap" style={{ marginTop: 8 }}>
                <button
                  type="button"
                  className="primary"
                  onClick={apply}
                  disabled={!result.trim()}
                  style={{ padding: '4px 12px', fontSize: '0.85rem' }}
                >
                  ✓ Aplicar
                </button>
                <button
                  type="button"
                  onClick={() => rewrite(variant)}
                  style={{ padding: '4px 12px', fontSize: '0.85rem' }}
                >
                  🔄 Tentar de novo
                </button>
                <button
                  type="button"
                  className="ghost"
                  onClick={() => {
                    setOpen(false);
                    reset();
                  }}
                  style={{ padding: '4px 12px', fontSize: '0.85rem' }}
                >
                  Cancelar
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
