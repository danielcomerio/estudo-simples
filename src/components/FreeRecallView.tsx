'use client';

import { useState } from 'react';
import { selectActiveQuestions, useStore } from '@/lib/store';
import { selectDisciplinas } from '@/lib/store';
import {
  getAIKey,
  getDefaultProvider,
  PROVIDER_LABELS,
} from '@/lib/ai-keys';
import { getActivePersonaPrompt, withPersona } from '@/lib/persona-active';
import { streamAIChat } from '@/lib/ai-stream';
import { MicButton } from './MicButton';
import { toast } from './Toast';

/**
 * Free recall: técnica metacognitiva poderosa. User escolhe um tópico,
 * escreve LIVRE tudo que lembra, IA avalia cobertura comparando com
 * conhecimento esperado.
 *
 * Por que: forçar produção (vs reconhecimento como em múltipla escolha)
 * fortalece muito mais a memória de longo prazo. Pesquisa de Karpicke.
 */
export function FreeRecallView() {
  const provider = getDefaultProvider();
  const disciplinas = useStore(selectDisciplinas);
  const questions = useStore(selectActiveQuestions);
  const [topic, setTopic] = useState('');
  const [response, setResponse] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (!provider) {
    return (
      <div className="card">
        <h1 style={{ margin: '0 0 8px' }}>Free recall</h1>
        <p className="muted">
          Esta feature precisa de chave IA configurada em{' '}
          <a href="/configuracoes#ai-keys">/configuracoes</a>.
        </p>
      </div>
    );
  }

  const evaluate = async () => {
    if (!topic.trim() || !response.trim()) {
      toast('Preencha tópico e sua escrita livre', 'warn');
      return;
    }
    const apiKey = getAIKey(provider);
    if (!apiKey) {
      toast('Sem chave', 'error');
      return;
    }
    setLoading(true);
    setFeedback('');

    const ctx = questions
      .filter((q) => q.disciplina_id?.toLowerCase().includes(topic.toLowerCase()))
      .slice(0, 10)
      .map((q) => {
        const p = q.payload as { enunciado?: string; explicacao_geral?: string };
        return `${(p.enunciado ?? '').slice(0, 200)}\n${(p.explicacao_geral ?? '').slice(0, 200)}`;
      })
      .join('\n---\n');

    const promptBase = `Você é um avaliador de free recall. Estudante escreveu LIVRE tudo que sabe sobre "${topic}".

ESCRITA DO ESTUDANTE:
${response}

${ctx ? `CONTEXTO DO BANCO (questões existentes sobre o tema):\n${ctx}` : ''}

Avalie em 3 partes (max 250 palavras total):
1. **Cobertura**: o que ele acertou em mencionar (% estimado)
2. **Lacunas**: o que ele NÃO mencionou e deveria saber (3-5 pontos chave)
3. **Imprecisões**: erros conceituais ou afirmações duvidosas

Use markdown. Tom direto, pt-BR.`;

    const personaPrompt = await getActivePersonaPrompt();
    streamAIChat(
      {
        provider,
        apiKey,
        prompt: withPersona(promptBase, personaPrompt),
        kind: 'free-recall',
      },
      {
        onChunk: (chunk) => setFeedback((cur) => (cur ?? '') + chunk),
        onDone: () => setLoading(false),
        onError: (msg) => {
          toast(msg, 'error');
          setLoading(false);
        },
      }
    );
  };

  return (
    <>
      <div className="card">
        <h1 style={{ margin: '0 0 4px' }}>🧠 Free recall</h1>
        <p className="muted" style={{ margin: 0, fontSize: '0.9rem' }}>
          Técnica de Karpicke: escreva LIVRE tudo que lembra sobre um tópico.
          IA aponta lacunas. Forçar produção (vs reconhecimento) fortalece
          memória.
        </p>
      </div>

      <div className="card">
        <label style={{ display: 'block', marginBottom: 12 }}>
          <span style={{ fontSize: '0.88rem' }}>Tópico (digite ou escolha):</span>
          <input
            type="text"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="ex: Direito Constitucional, princípios da administração, etc"
            style={{ width: '100%', marginTop: 4 }}
            list="dis-list"
          />
          <datalist id="dis-list">
            {disciplinas.map((d) => (
              <option key={d} value={d} />
            ))}
          </datalist>
        </label>

        <div style={{ marginBottom: 8 }}>
          <div className="row gap" style={{ alignItems: 'center', marginBottom: 4 }}>
            <span style={{ fontSize: '0.88rem' }}>Sua escrita livre:</span>
            <span style={{ flex: 1 }} />
            <MicButton
              continuous
              size="sm"
              title="Ditar"
              onTranscript={(t) => setResponse((cur) => (cur ? `${cur} ${t}` : t))}
            />
          </div>
          <textarea
            value={response}
            onChange={(e) => setResponse(e.target.value)}
            placeholder="Escreva tudo que você lembra sobre o tópico, sem consultar nada. Quanto mais, melhor — mesmo coisas óbvias."
            rows={10}
            style={{ width: '100%', fontSize: '0.92rem' }}
          />
        </div>

        <button
          type="button"
          className="primary"
          onClick={evaluate}
          disabled={loading || !topic.trim() || response.length < 50}
          style={{ marginTop: 8 }}
        >
          {loading ? 'Avaliando…' : `🤖 Avaliar via ${PROVIDER_LABELS[provider]}`}
        </button>
        <p className="muted" style={{ fontSize: '0.78rem', marginTop: 6 }}>
          Min 50 chars. IA usa banco existente como referência se há questões
          do tópico.
        </p>
      </div>

      {feedback && (
        <div
          className="card"
          style={{
            borderLeft: '3px solid var(--primary)',
            whiteSpace: 'pre-wrap',
            fontSize: '0.92rem',
            lineHeight: 1.55,
          }}
        >
          {feedback}
        </div>
      )}
    </>
  );
}
