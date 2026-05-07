'use client';

import { useState } from 'react';
import { toast } from './Toast';

/**
 * Gerador de prompt pra IAs externas (Claude, ChatGPT, Gemini).
 *
 * Fluxo: user define parâmetros (disciplina, banca, tipo, qtd...) →
 * componente monta um prompt completo com schema JSON do app → user
 * copia e cola na IA → cola a resposta JSON no /banco import zone.
 *
 * NÃO chama API de IA diretamente. Sem custo, sem chave de API,
 * 100% client-side. Aproveita as 3 IAs gratuitas mais comuns.
 */

type QuestionType = 'objetiva' | 'discursiva' | 'cloze' | 'flashcard';

const TYPE_LABEL: Record<QuestionType, string> = {
  objetiva: 'Objetiva (múltipla escolha)',
  discursiva: 'Discursiva',
  cloze: 'Cloze (preenchimento de lacunas)',
  flashcard: 'Flashcard (frente/verso)',
};

const SCHEMA_OBJETIVA = `{
  "type": "objetiva",
  "disciplina_id": "<nome de exibição — ex: \"Direito Constitucional\">",
  "tema": "<tema específico, opcional>",
  "dificuldade": 1-5,
  "tags": ["tag1", "tag2"],
  "gabarito_source": "ia",
  "payload": {
    "enunciado": "<enunciado completo>",
    "alternativas": [
      { "letra": "A", "texto": "...", "correta": false, "explicacao": "por que está errada" },
      { "letra": "B", "texto": "...", "correta": true,  "explicacao": "por que está certa" },
      { "letra": "C", "texto": "...", "correta": false, "explicacao": "..." },
      { "letra": "D", "texto": "...", "correta": false, "explicacao": "..." },
      { "letra": "E", "texto": "...", "correta": false, "explicacao": "..." }
    ],
    "explicacao_geral": "<contexto adicional, opcional>",
    "pegadinhas": ["pegadinha 1", "pegadinha 2"],
    "mnemonic": "<mnemônico opcional>"
  }
}`;

const SCHEMA_DISCURSIVA = `{
  "type": "discursiva",
  "disciplina_id": "<nome de exibição — ex: \"Direito Constitucional\">",
  "tema": "<tema>",
  "dificuldade": 1-5,
  "payload": {
    "enunciado": "<enunciado completo>",
    "espelho": "<resposta-modelo bem detalhada>",
    "quesitos": [
      { "id": 1, "descricao": "...", "peso": 0.3, "max": 10 },
      { "id": 2, "descricao": "...", "peso": 0.4, "max": 10 },
      { "id": 3, "descricao": "...", "peso": 0.3, "max": 10 }
    ],
    "conceitos_chave": ["conceito 1", "conceito 2"],
    "pegadinhas_esperadas": ["pegadinha 1"]
  }
}`;

const SCHEMA_CLOZE = `{
  "type": "cloze",
  "disciplina_id": "<nome de exibição — ex: \"Direito Constitucional\">",
  "tema": "<tema>",
  "dificuldade": 1-5,
  "payload": {
    "texto": "Frase com {{c1::lacuna 1}} e {{c2::lacuna 2}}.",
    "explicacao": "<explicação opcional>"
  }
}`;

const SCHEMA_FLASHCARD = `{
  "type": "flashcard",
  "disciplina_id": "<nome de exibição — ex: \"Direito Constitucional\">",
  "tema": "<tema>",
  "dificuldade": 1-5,
  "payload": {
    "frente": "<pergunta ou conceito>",
    "verso": "<resposta detalhada>",
    "explicacao": "<contexto adicional, opcional>"
  }
}`;

const SCHEMAS: Record<QuestionType, string> = {
  objetiva: SCHEMA_OBJETIVA,
  discursiva: SCHEMA_DISCURSIVA,
  cloze: SCHEMA_CLOZE,
  flashcard: SCHEMA_FLASHCARD,
};

function buildPrompt(opts: {
  type: QuestionType;
  disciplina: string;
  banca?: string;
  tema?: string;
  qtd: number;
  dificuldade: number;
  notas?: string;
}): string {
  const { type, disciplina, banca, tema, qtd, dificuldade, notas } = opts;
  const schema = SCHEMAS[type];
  const bancaLine = banca
    ? `\n- Banca alvo: ${banca} (use o estilo dessa banca: enunciado, alternativas plausíveis, distratores típicos)`
    : '';
  const temaLine = tema ? `\n- Tema específico: ${tema}` : '';
  const notasLine = notas ? `\n- Observações: ${notas}` : '';

  return `Você é um especialista em criar questões de concurso público brasileiro. Gere ${qtd} ${
    qtd > 1 ? 'questões' : 'questão'
  } de ALTA QUALIDADE com as seguintes características:

- Disciplina: ${disciplina}
- Tipo: ${TYPE_LABEL[type]}
- Dificuldade: ${dificuldade}/5${bancaLine}${temaLine}${notasLine}

REGRAS OBRIGATÓRIAS:
1. Saída em JSON válido. APENAS JSON, sem texto antes ou depois, sem markdown, sem \`\`\`json.
2. Se for múltiplas questões, retorne um ARRAY \`[...]\`. Se for 1 só, pode ser objeto único.
3. Cada questão segue ESTRITAMENTE este schema:

${schema}

4. Para questões objetivas: 5 alternativas (A-E), apenas UMA correta, distratores plausíveis (não óbvios), explicações para CADA alternativa.
5. Para discursivas: espelho rico, quesitos somam peso 1.0.
6. Cloze: lacunas reais e desafiadoras (não óbvias pelo contexto).
7. Flashcard: frente direta, verso detalhado.
8. NUNCA inventar dados (leis fictícias, súmulas inexistentes). Se não souber, ESCOLHA OUTRO TEMA dentro da disciplina.
9. Português brasileiro formal, sem erros de ortografia ou concordância.
10. Dificuldade ${dificuldade}/5: ${dificultyHint(dificuldade)}
11. NORMALIZAÇÃO obrigatória dos campos de catalogação:
   - "disciplina_id": EXATAMENTE "${disciplina}" (mesma capitalização e acentos — não inventar variantes).
   - "tags": SEMPRE kebab-case ASCII (lowercase, sem acento, hífens entre palavras). Ex: ["art-5-cf", "controle-difuso", "banca-fgv"]. NUNCA "Art_5_CF" ou "Controle Difuso".
   - "tema": frase curta com capitalização e acentos normais (display).
12. SEMPRE incluir "gabarito_source": "ia" — sinaliza pro app que esse gabarito veio de IA e precisa validação contra fonte oficial. Não invente outro valor; sempre "ia" pra questões geradas por você.

RETORNE APENAS O JSON. NADA MAIS.`;
}

function dificultyHint(n: number): string {
  switch (n) {
    case 1:
      return 'questão introdutória, conceito básico, alternativas bem distinguíveis.';
    case 2:
      return 'questão fácil, exige memorização básica.';
    case 3:
      return 'questão média, exige aplicação do conceito.';
    case 4:
      return 'questão difícil, exige análise + integração de conceitos.';
    case 5:
      return 'questão muito difícil, com pegadinhas e detalhes sutis típicos de prova final.';
    default:
      return 'questão média.';
  }
}

const AI_LINKS = [
  {
    name: 'Claude',
    url: 'https://claude.ai/new',
    color: '#cf6e3a',
    note: 'recomendado pra qualidade',
  },
  {
    name: 'ChatGPT',
    url: 'https://chat.openai.com/',
    color: '#10a37f',
    note: 'rápido',
  },
  {
    name: 'Gemini',
    url: 'https://gemini.google.com/',
    color: '#4285f4',
    note: 'grátis sem login limitado',
  },
];

type PromptMode = 'questoes' | 'mnemonico' | 'resumo' | 'tags' | 'plano';

const MODE_LABEL: Record<PromptMode, string> = {
  questoes: '📝 Gerar questões',
  mnemonico: '🧠 Mnemônicos',
  resumo: '📖 Resumir tópico',
  tags: '🏷 Sugerir tags',
  plano: '📅 Plano de estudos',
};

function buildSecondaryPrompt(opts: {
  mode: PromptMode;
  disciplina: string;
  tema?: string;
  notas?: string;
  qtd: number;
}): string {
  const { mode, disciplina, tema, qtd, notas } = opts;
  const temaLine = tema ? ` (tema: ${tema})` : '';
  const notasLine = notas ? `\n\nObservações: ${notas}` : '';

  if (mode === 'mnemonico') {
    return `Você é especialista em técnicas de memorização. Gere ${qtd} mnemônico${qtd === 1 ? '' : 's'} curto${qtd === 1 ? '' : 's'} pra memorizar conteúdo de **${disciplina}**${temaLine}.

Cada mnemônico deve:
- Ter no máximo 1 frase memorável (ou um acrônimo claro)
- Ser fácil de associar ao conteúdo
- Funcionar pra concursos brasileiros

Formato: lista numerada, cada item com:
1. **[acrônimo / frase]** — explicação curta do que ele lembra.${notasLine}

Sem JSON, sem markdown extra. Texto direto.`;
  }

  if (mode === 'resumo') {
    return `Você é professor de cursinho. Faça um resumo conciso (~300 palavras) de **${disciplina}${temaLine}** focado em prova de concurso público brasileiro.

Cubra:
- Conceito central
- 3-5 pontos-chave que costumam cair em prova
- Pegadinhas comuns (banca brasileira)
- 1-2 exemplos rápidos

Use bullet points e bold pra termos técnicos. Sem floreio.${notasLine}`;
  }

  if (mode === 'tags') {
    return `Sugira ${qtd} tags adequadas pra catalogar questões de **${disciplina}${temaLine}** num app de SRS (concurso público brasileiro).

Cada tag deve:
- Ser curta (1-3 palavras, kebab-case ex: "art-5-cf")
- Específica o suficiente pra agrupar questões similares
- Não muito ampla (não use só "português" — prefira "regência-verbal")

Formato: lista simples, uma tag por linha, sem numeração.${notasLine}`;
  }

  if (mode === 'plano') {
    return `Você é coach de concurseiro. Crie um plano de estudos de ${qtd} dia${qtd === 1 ? '' : 's'} pra dominar **${disciplina}${temaLine}**.

Cada dia deve ter:
- Tópico do dia (claro e objetivo)
- 1-2 atividades práticas (ler, resolver, revisar)
- Tempo estimado (60-180 min)

Formato:
**Dia 1: [tópico]**
- Atividade 1 (Xmin)
- Atividade 2 (Ymin)

Sem JSON.${notasLine}`;
  }

  return '';
}

export function AIPromptGenerator() {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<PromptMode>('questoes');
  const [type, setType] = useState<QuestionType>('objetiva');
  const [disciplina, setDisciplina] = useState('');
  const [banca, setBanca] = useState('');
  const [tema, setTema] = useState('');
  const [qtd, setQtd] = useState(5);
  const [dificuldade, setDificuldade] = useState(3);
  const [notas, setNotas] = useState('');
  const [generated, setGenerated] = useState('');

  const generate = () => {
    if (!disciplina.trim()) {
      toast('Informe a disciplina', 'error');
      return;
    }
    let prompt: string;
    if (mode === 'questoes') {
      prompt = buildPrompt({
        type,
        disciplina: disciplina.trim(),
        banca: banca.trim() || undefined,
        tema: tema.trim() || undefined,
        qtd: Math.max(1, Math.min(50, qtd)),
        dificuldade,
        notas: notas.trim() || undefined,
      });
    } else {
      prompt = buildSecondaryPrompt({
        mode,
        disciplina: disciplina.trim(),
        tema: tema.trim() || undefined,
        qtd: Math.max(1, Math.min(50, qtd)),
        notas: notas.trim() || undefined,
      });
    }
    setGenerated(prompt);
  };

  const copyPrompt = async () => {
    if (!generated) {
      generate();
      return;
    }
    try {
      await navigator.clipboard.writeText(generated);
      toast('Prompt copiado! Cole numa IA pra gerar.', 'success');
    } catch {
      toast('Não consegui copiar — selecione manual e copie', 'error');
    }
  };

  if (!open) {
    return (
      <button
        type="button"
        className="ghost"
        onClick={() => setOpen(true)}
        style={{ marginRight: 8 }}
        title="Gera prompt pronto pra Claude/GPT/Gemini criar questões"
      >
        🤖 Gerar com IA
      </button>
    );
  }

  return (
    <>
      <button
        type="button"
        className="ghost"
        onClick={() => setOpen(false)}
        style={{ marginRight: 8 }}
      >
        ✕ Fechar gerador
      </button>
      <div
        className="card"
        style={{
          marginTop: 12,
          background: 'var(--bg-elev-2)',
          border: '1px solid var(--primary)',
        }}
      >
        <h3 style={{ margin: '0 0 4px' }}>🤖 Hub de prompts pra IA</h3>
        <p
          className="muted"
          style={{ margin: '0 0 12px', fontSize: '0.88rem' }}
        >
          Configure os parâmetros e copie o prompt pronto pra Claude /
          ChatGPT / Gemini. Sem chave de API, sem custo.
        </p>

        {/* Tabs de modo */}
        <div
          className="row gap wrap"
          style={{ marginBottom: 14, gap: 6 }}
          role="tablist"
        >
          {(Object.keys(MODE_LABEL) as PromptMode[]).map((m) => {
            const active = mode === m;
            return (
              <button
                key={m}
                type="button"
                role="tab"
                aria-selected={active}
                className={active ? 'primary' : 'ghost'}
                onClick={() => {
                  setMode(m);
                  setGenerated('');
                }}
                style={{ padding: '6px 10px', fontSize: '0.85rem' }}
              >
                {MODE_LABEL[m]}
              </button>
            );
          })}
        </div>

        <div className="form-grid">
          <label>
            <span>Disciplina *</span>
            <input
              type="text"
              value={disciplina}
              onChange={(e) => setDisciplina(e.target.value)}
              placeholder="ex: Direito Constitucional"
              required
            />
          </label>
          <label>
            <span>{mode === 'questoes' ? 'Tipo' : 'Tipo (não usado)'}</span>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as QuestionType)}
              disabled={mode !== 'questoes'}
            >
              <option value="objetiva">Objetiva (A-E)</option>
              <option value="discursiva">Discursiva</option>
              <option value="cloze">Cloze (lacunas)</option>
              <option value="flashcard">Flashcard</option>
            </select>
          </label>
          {mode === 'questoes' && (
            <label>
              <span>Banca (opcional)</span>
              <input
                type="text"
                value={banca}
                onChange={(e) => setBanca(e.target.value)}
                placeholder="ex: FGV, Cebraspe, FCC"
              />
            </label>
          )}
          <label>
            <span>Tema (opcional)</span>
            <input
              type="text"
              value={tema}
              onChange={(e) => setTema(e.target.value)}
              placeholder="ex: Controle de constitucionalidade"
            />
          </label>
          <label>
            <span>
              {mode === 'questoes'
                ? 'Quantidade'
                : mode === 'mnemonico'
                  ? 'Quantidade de mnemônicos'
                  : mode === 'tags'
                    ? 'Quantidade de tags'
                    : mode === 'plano'
                      ? 'Quantos dias'
                      : 'Quantidade'}
            </span>
            <input
              type="number"
              min={1}
              max={50}
              value={qtd}
              onChange={(e) => setQtd(parseInt(e.target.value) || 1)}
            />
          </label>
          {mode === 'questoes' && (
            <label>
              <span>Dificuldade (1-5)</span>
              <input
                type="number"
                min={1}
                max={5}
                value={dificuldade}
                onChange={(e) => setDificuldade(parseInt(e.target.value) || 3)}
              />
            </label>
          )}
          <label style={{ gridColumn: '1 / -1' }}>
            <span>Observações (opcional)</span>
            <textarea
              rows={2}
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              placeholder="ex: foque em pegadinhas comuns, prefira jurisprudência atual, etc."
            />
          </label>
        </div>

        <div
          className="row gap"
          style={{ marginTop: 14, flexWrap: 'wrap' }}
        >
          <button type="button" className="primary" onClick={generate}>
            Gerar prompt
          </button>
          {generated && (
            <button type="button" onClick={copyPrompt}>
              📋 Copiar
            </button>
          )}
        </div>

        {generated && (
          <>
            <details style={{ marginTop: 14 }} open>
              <summary
                style={{
                  cursor: 'pointer',
                  fontWeight: 500,
                  marginBottom: 8,
                }}
              >
                Prompt gerado ({generated.length} chars)
              </summary>
              <textarea
                value={generated}
                onChange={(e) => setGenerated(e.target.value)}
                rows={10}
                style={{
                  width: '100%',
                  fontSize: '0.82rem',
                  fontFamily: 'var(--font-mono, monospace)',
                  marginTop: 8,
                }}
                onFocus={(e) => e.target.select()}
              />
            </details>

            <div
              style={{
                marginTop: 14,
                padding: 12,
                background: 'var(--bg-elev)',
                borderRadius: 'var(--radius)',
                border: '1px solid var(--border)',
              }}
            >
              <div
                style={{
                  fontWeight: 500,
                  marginBottom: 8,
                  fontSize: '0.92rem',
                }}
              >
                Abrir IA com o prompt copiado:
              </div>
              <div className="row gap" style={{ flexWrap: 'wrap' }}>
                {AI_LINKS.map((ai) => (
                  <a
                    key={ai.name}
                    href={ai.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => {
                      void copyPrompt();
                    }}
                    style={{
                      padding: '8px 14px',
                      borderRadius: 'var(--radius)',
                      border: `1px solid ${ai.color}`,
                      background: 'transparent',
                      color: ai.color,
                      textDecoration: 'none',
                      fontWeight: 500,
                      fontSize: '0.9rem',
                    }}
                    title={ai.note}
                  >
                    Abrir {ai.name} →
                  </a>
                ))}
              </div>
              <p
                className="muted"
                style={{
                  margin: '10px 0 0',
                  fontSize: '0.78rem',
                  lineHeight: 1.5,
                }}
              >
                Ao clicar, copia o prompt e abre a IA em nova aba.
                Cole (Ctrl+V) na conversa, espere a resposta JSON, e
                cole aqui no app na área de import abaixo.
              </p>
            </div>
          </>
        )}
      </div>
    </>
  );
}
