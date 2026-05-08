'use client';

/**
 * Classificador IA pra mapear disciplinas novas (vindas de import) com
 * disciplinas existentes do user. Mais preciso que o fuzzy match Jaccard
 * de `suggestDisciplinaMapping` quando o nome diverge muito do canônico
 * (ex: "Cont. Geral" vs "Contabilidade").
 *
 * Uma única chamada multi-mapping (economia de tokens).
 *
 * Output: Map<novoNome, { matchNome | null, confidence: 0-1 }>
 */

import {
  getAIKey,
  getDefaultProvider,
} from '@/lib/ai-keys';
import { getActivePersonaPrompt, withPersona } from './persona-active';

export type AIDiscMapping = {
  match: string | null;
  confidence: number;
};

export type AIDiscMappingResult = Map<string, AIDiscMapping>;

function buildPrompt(novos: string[], existentes: string[]): string {
  const lines: string[] = [
    'Você ajuda a normalizar disciplinas de concurso público. Mapeie cada disciplina NOVA pra uma EXISTENTE quando elas se referem ao mesmo conteúdo (mesmo que o nome esteja abreviado, traduzido ou em outra grafia). Senão, retorne null.',
    '',
    'EXISTENTES (escolha uma destas como match, exatamente como escritas):',
    ...existentes.map((e, i) => `${i + 1}. ${e}`),
    '',
    'NOVAS (mapeie cada uma):',
    ...novos.map((n, i) => `N${i + 1}. ${n}`),
    '',
    'Responda APENAS com JSON neste formato (sem markdown, sem texto extra):',
    '{"mappings": [{"novo": "<texto exato>", "match": "<texto exato da existente OU null>", "confidence": <0.0-1.0>}, ...]}',
    '',
    'Confidence: 1.0 = certeza absoluta (mesmo conteúdo), 0.5 = parcial (subset/superset), <0.4 = não mapear (use null).',
  ];
  return lines.join('\n');
}

// Exportado pra testes (parseResponse_internalForTests). Não usar em
// produção fora deste módulo.
export function parseResponse(text: string, novos: string[]): AIDiscMappingResult {
  const out: AIDiscMappingResult = new Map();
  for (const n of novos) out.set(n, { match: null, confidence: 0 });
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) return out;
  try {
    const j = JSON.parse(m[0]);
    if (Array.isArray(j.mappings)) {
      for (const it of j.mappings) {
        if (typeof it?.novo !== 'string') continue;
        const match = typeof it.match === 'string' && it.match.trim() ? it.match : null;
        const confidence =
          typeof it.confidence === 'number'
            ? Math.max(0, Math.min(1, it.confidence))
            : 0;
        out.set(it.novo, { match, confidence });
      }
    }
  } catch {
    /* ignore */
  }
  return out;
}

export async function aiSuggestDisciplinaMapping(
  novosNomes: string[],
  existentes: Array<{ id: string; nome: string }>
): Promise<AIDiscMappingResult | null> {
  if (novosNomes.length === 0 || existentes.length === 0) return null;
  const provider = getDefaultProvider();
  if (!provider) return null;
  const apiKey = getAIKey(provider);
  if (!apiKey) return null;

  const personaPrompt = await getActivePersonaPrompt();
  const prompt = withPersona(
    buildPrompt(novosNomes, existentes.map((e) => e.nome)),
    personaPrompt
  );

  try {
    const res = await fetch('/api/ai/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        provider,
        apiKey,
        prompt,
        kind: 'disc-classify',
        cacheable: !personaPrompt,
      }),
    });
    if (!res.ok) return null;
    const j = (await res.json()) as { text: string };
    return parseResponse(j.text ?? '', novosNomes);
  } catch {
    return null;
  }
}
