/**
 * Geração de questões via IA (BYO key) — prompt + parser.
 *
 * Estratégia:
 *  1. Pede a IA pra retornar JSON estruturado (não markdown ou texto
 *     livre). Sempre via "responda APENAS com JSON" no system message.
 *  2. Tolerante a wrapper markdown (```json ... ```) e BOM.
 *  3. Validação por questão: descarta itens malformados, mantém os que
 *     casam com nosso schema.
 *
 * Output: array de Question parciais (sem id/user_id/srs/stats/timestamps —
 * são preenchidos no addQuestionLocal).
 */

import type {
  Alternativa,
  ObjetivaPayload,
  DiscursivaPayload,
  ClozePayload,
  FlashcardPayload,
  QuestionType,
} from './types';

export type GenerateConfig = {
  /** Tema/comando livre (ex: "Princípios da administração pública na CF/88"). */
  topic: string;
  /** Quantidade alvo (1-20). */
  qtd: number;
  /** Tipo de questão a gerar. */
  type: QuestionType;
  /** Banca de referência (estilo do enunciado). Vazio = genérico. */
  banca?: string;
  /** Disciplina (vai pra disciplina_id da questão). */
  disciplina?: string;
  /** Dificuldade alvo 1-5. */
  dificuldade?: number;
};

export type GeneratedQuestion = {
  type: QuestionType;
  disciplina_id?: string | null;
  banca_estilo?: string | null;
  dificuldade?: number | null;
  tema?: string | null;
  payload:
    | Partial<ObjetivaPayload>
    | Partial<DiscursivaPayload>
    | Partial<ClozePayload>
    | Partial<FlashcardPayload>;
};

/**
 * Constrói o prompt completo. Inclui instruções rígidas de formato JSON
 * e exemplo do schema esperado por tipo.
 */
export function buildGenerationPrompt(cfg: GenerateConfig): string {
  const banca = cfg.banca?.trim() || 'banca brasileira de concurso público';
  const dificuldade = cfg.dificuldade ?? 3;
  const tipo = cfg.type;

  const schemaExample = SCHEMA_EXAMPLES[tipo];

  return `Você é um banca examinadora especialista em ${banca}. Crie ${cfg.qtd} questão(ões) do tipo "${tipo}" sobre o tema abaixo, no estilo desta banca, com nível de dificuldade ${dificuldade}/5.

TEMA / COMANDO:
${cfg.topic}

REGRAS RÍGIDAS:
1. Responda APENAS com JSON válido — sem texto antes/depois, sem markdown, sem explicação.
2. Estrutura: array JSON de objetos, mesmo que seja apenas 1 questão.
3. Cada questão deve seguir EXATAMENTE este schema:
${schemaExample}
4. Para "objetiva": SEMPRE 5 alternativas (A-E), exatamente 1 com correta=true, todas com explicacao curta.
5. Linguagem em pt-BR formal, estilo prova de concurso.
6. NÃO INVENTE jurisprudência, número de lei, datas — se não tiver certeza, evite citar.
7. NÃO use emoji nas questões.

Comece direto com [`;
}

const SCHEMA_EXAMPLES: Record<QuestionType, string> = {
  objetiva: `{
  "enunciado": "string com a pergunta",
  "alternativas": [
    {"letra": "A", "texto": "...", "correta": false, "explicacao": "por que está errada"},
    {"letra": "B", "texto": "...", "correta": true, "explicacao": "por que está certa"},
    {"letra": "C", "texto": "...", "correta": false, "explicacao": "..."},
    {"letra": "D", "texto": "...", "correta": false, "explicacao": "..."},
    {"letra": "E", "texto": "...", "correta": false, "explicacao": "..."}
  ],
  "explicacao_geral": "contexto geral / fundamento legal"
}`,
  discursiva: `{
  "enunciado": "comando da questão",
  "espelho_resposta": "resposta-modelo completa em prosa",
  "conceitos_chave": ["conceito 1", "conceito 2"],
  "rubrica": [{"criterio": "Coerência", "pontos": 3}, {"criterio": "Domínio do tema", "pontos": 4}]
}`,
  cloze: `{
  "texto": "Frase com {{c1::lacuna1}} e {{c2::lacuna2}} pra completar.",
  "explicacao": "contexto opcional"
}`,
  flashcard: `{
  "frente": "pergunta curta",
  "verso": "resposta curta"
}`,
};

/**
 * Parser tolerante: aceita JSON puro, JSON dentro de ```json ... ```,
 * BOM. Retorna array (mesmo se IA retornou objeto único — wrapped).
 */
export function parseGeneratedJSON(raw: string): unknown[] {
  let s = raw.trim();
  // Remove BOM
  if (s.startsWith('﻿')) s = s.slice(1);
  // Remove fence ```json ... ```
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) s = fence[1].trim();
  // Tenta corrigir resposta truncada: cortar no último ']'
  if (!s.endsWith(']') && !s.endsWith('}')) {
    const lastBracket = Math.max(s.lastIndexOf(']'), s.lastIndexOf('}'));
    if (lastBracket > 0) s = s.slice(0, lastBracket + 1);
  }
  try {
    const parsed = JSON.parse(s);
    if (Array.isArray(parsed)) return parsed;
    if (typeof parsed === 'object' && parsed !== null) return [parsed];
    return [];
  } catch {
    return [];
  }
}

/**
 * Valida + normaliza item gerado pra GeneratedQuestion. Retorna null
 * se item inválido.
 */
export function validateGeneratedItem(
  item: unknown,
  cfg: GenerateConfig
): GeneratedQuestion | null {
  if (!item || typeof item !== 'object') return null;
  const obj = item as Record<string, unknown>;
  const type = cfg.type;

  if (type === 'objetiva') {
    const enunciado = obj.enunciado;
    const alts = obj.alternativas;
    if (typeof enunciado !== 'string' || !enunciado.trim()) return null;
    if (!Array.isArray(alts) || alts.length < 2) return null;
    const altsValid: Alternativa[] = [];
    let hasCorrect = false;
    for (const a of alts) {
      if (!a || typeof a !== 'object') return null;
      const ao = a as Record<string, unknown>;
      const letra = typeof ao.letra === 'string' ? ao.letra : '';
      const texto = typeof ao.texto === 'string' ? ao.texto : '';
      const correta = ao.correta === true;
      if (!letra || !texto) return null;
      if (correta) hasCorrect = true;
      altsValid.push({
        letra,
        texto,
        correta,
        explicacao: typeof ao.explicacao === 'string' ? ao.explicacao : undefined,
      });
    }
    if (!hasCorrect) return null;
    return {
      type: 'objetiva',
      disciplina_id: cfg.disciplina ?? null,
      banca_estilo: cfg.banca ?? null,
      dificuldade: cfg.dificuldade ?? null,
      tema: cfg.topic.slice(0, 200),
      payload: {
        enunciado,
        alternativas: altsValid,
        explicacao_geral:
          typeof obj.explicacao_geral === 'string'
            ? obj.explicacao_geral
            : undefined,
      },
    };
  }

  if (type === 'discursiva') {
    const enunciado = obj.enunciado;
    const espelho = obj.espelho_resposta;
    if (typeof enunciado !== 'string' || !enunciado.trim()) return null;
    if (typeof espelho !== 'string' || !espelho.trim()) return null;
    return {
      type: 'discursiva',
      disciplina_id: cfg.disciplina ?? null,
      banca_estilo: cfg.banca ?? null,
      dificuldade: cfg.dificuldade ?? null,
      tema: cfg.topic.slice(0, 200),
      payload: {
        enunciado,
        espelho_resposta: espelho,
        conceitos_chave: Array.isArray(obj.conceitos_chave)
          ? (obj.conceitos_chave as unknown[]).filter(
              (c): c is string => typeof c === 'string'
            )
          : undefined,
        rubrica: Array.isArray(obj.rubrica)
          ? (obj.rubrica as Array<Record<string, unknown>>)
              .filter((r) => typeof r?.criterio === 'string' && typeof r?.pontos === 'number')
              .map((r) => ({ criterio: r.criterio as string, pontos: r.pontos as number }))
          : undefined,
      },
    };
  }

  if (type === 'cloze') {
    const texto = obj.texto;
    if (typeof texto !== 'string' || !texto.trim()) return null;
    if (!/\{\{c\d+::[^}]+\}\}/.test(texto)) return null; // precisa ter ao menos 1 lacuna
    return {
      type: 'cloze',
      disciplina_id: cfg.disciplina ?? null,
      banca_estilo: cfg.banca ?? null,
      dificuldade: cfg.dificuldade ?? null,
      tema: cfg.topic.slice(0, 200),
      payload: {
        texto,
        explicacao:
          typeof obj.explicacao === 'string' ? obj.explicacao : undefined,
      },
    };
  }

  if (type === 'flashcard') {
    const frente = obj.frente;
    const verso = obj.verso;
    if (typeof frente !== 'string' || !frente.trim()) return null;
    if (typeof verso !== 'string' || !verso.trim()) return null;
    return {
      type: 'flashcard',
      disciplina_id: cfg.disciplina ?? null,
      banca_estilo: cfg.banca ?? null,
      dificuldade: cfg.dificuldade ?? null,
      tema: cfg.topic.slice(0, 200),
      payload: { frente, verso },
    };
  }

  return null;
}

export function parseAndValidate(
  raw: string,
  cfg: GenerateConfig
): { items: GeneratedQuestion[]; discarded: number } {
  const parsed = parseGeneratedJSON(raw);
  let discarded = 0;
  const items: GeneratedQuestion[] = [];
  for (const p of parsed) {
    const v = validateGeneratedItem(p, cfg);
    if (v) items.push(v);
    else discarded++;
  }
  return { items, discarded };
}
