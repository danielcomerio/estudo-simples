/**
 * Suporte a importação de questões REAIS (extraídas de QConcursos ou
 * sites similares). Formato externo bem diferente do nosso autoral —
 * este módulo detecta e converte.
 *
 * Funções principais:
 *  - detectFormat(obj): 'real' | 'autoral' | 'unknown'
 *  - parseRealItem(raw): converte 1 questão real → ParsedRealItem com
 *    decisão (importar / descartar) + razão. Não joga fora silenciosamente
 *    — sempre retorna razão pra relatório.
 *  - jaccardSimilarity(a, b): comparador pra fuzzy match de disciplinas.
 *  - suggestDisciplinaMapping(novas, existentes): retorna sugestão de
 *    mapeamento pra cada nova baseado em similaridade.
 */

import type {
  Alternativa,
  DiscursivaPayload,
  ObjetivaPayload,
  Question,
  QuestionFonte,
} from './types';
import { newSRS, newStats } from './srs';
import {
  dedupeKey,
  extractItems,
  normalizeQuestion,
  safeParseJSON,
  validateQuestion,
} from './validation';

// =====================================================================
// Detecção de formato
// =====================================================================

export type RawFormat = 'real' | 'autoral' | 'unknown';

/**
 * Heurística baseada em campos exclusivos de cada formato:
 *  - Real (QConcursos): tem `materia` (em vez de disciplina_id) e
 *    `concursoAno` (camelCase). Quase sempre tem `banca`, `tipo`,
 *    `numero`/`id` numérico.
 *  - Autoral (nosso): tem `disciplina_id` (snake_case).
 */
export function detectFormat(obj: unknown): RawFormat {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return 'unknown';
  const o = obj as Record<string, unknown>;
  // Sinais fortes de "real" (QConcursos-like)
  const hasReal =
    typeof o.materia === 'string' &&
    typeof o.concursoAno === 'number' &&
    Array.isArray(o.alternativas);
  if (hasReal) return 'real';
  // Sinal de "autoral" — disciplina_id presente como string
  if (typeof o.disciplina_id === 'string') return 'autoral';
  return 'unknown';
}

// =====================================================================
// Detecção de hint de imagem no enunciado
// =====================================================================

/**
 * Palavras-chave que sugerem que a questão referencia uma imagem,
 * tabela ou figura externa que provavelmente NÃO veio no JSON. Falsa
 * positiva é aceitável — o user revisa as marcadas como duvidosas.
 *
 * Termos chosen empiricamente do material FGV/CESPE:
 *  - 'figura', 'imagem', 'gráfico', 'gravura'
 *  - 'tabela acima/abaixo' (referências contextuais)
 *  - 'esquema' (mais preciso que só ver a palavra solta)
 *  - 'mapa' / 'diagrama'
 *  - 'observe a/o' (caso de "observe a figura")
 */
const IMAGE_HINT_PATTERNS = [
  /\bfigur[ae]s?\b/i,
  /\bimage[mn]s?\b/i,
  /\bgr[áa]fico/i,
  /\bgravur[ae]s?\b/i,
  /\btabela\s+(acima|abaixo|seguinte|a\s+seguir)/i,
  /\besquema\s+(acima|abaixo|seguinte)/i,
  /\bmapa\s+(acima|abaixo|seguinte)/i,
  /\bdiagrama\s+(acima|abaixo|seguinte)/i,
  /\bobserve\s+(a|o)\s+(figur|imag|gr[áa]f|tabel|esquem|mapa|diagram)/i,
  /\b(veja|conforme)\s+(a|o)\s+(figur|imag|tabel|esquem)/i,
];

export function hasImageHint(text: string): boolean {
  if (!text || typeof text !== 'string') return false;
  return IMAGE_HINT_PATTERNS.some((rx) => rx.test(text));
}

// =====================================================================
// Parse de 1 item real → resultado decidido
// =====================================================================

export type ParseDecision = 'importar' | 'descartar';

export type ParsedRealItem = {
  decision: ParseDecision;
  /** Motivo legível pro user (sempre presente). */
  reason: string;
  /** Disciplina detectada (nome literal de `materia`). Sempre presente. */
  disciplinaNome: string | null;
  /** Question pronta pra inserir, exceto id/user_id/timestamps.
   *  Null quando decision='descartar'. */
  normalized:
    | (Omit<Question, 'id' | 'user_id' | 'created_at' | 'updated_at'> & {
        payload: ObjetivaPayload;
      })
    | null;
  /** Identificação pro relatório de descartadas/duvidosas. */
  externalId: string | number | null;
  numero: number | null;
};

/**
 * Converte 1 questão real → estado interno.
 *
 * Regras (baseadas nas decisões do user):
 *  - Decisão #1=B: gabarito '?' ou ausente → DESCARTAR (relatório)
 *  - Decisão #2=A: enunciado com hint de imagem → importa, marca
 *    verificacao='duvidosa'
 *  - anulada=true → marca verificacao='duvidosa'
 *  - tipo != 'MULTIPLA_ESCOLHA' → DESCARTAR (não suportado)
 *  - alternativas insuficientes (<2) → DESCARTAR
 */
export function parseRealItem(raw: unknown): ParsedRealItem {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return {
      decision: 'descartar',
      reason: 'item não é objeto JSON',
      disciplinaNome: null,
      normalized: null,
      externalId: null,
      numero: null,
    };
  }
  const o = raw as Record<string, unknown>;

  const externalId =
    typeof o.id === 'number' || typeof o.id === 'string' ? o.id : null;
  const numero = typeof o.numero === 'number' ? o.numero : null;
  const disciplinaNome =
    typeof o.materia === 'string' && o.materia.trim() ? o.materia.trim() : null;

  // Tipo só aceita objetiva (MULTIPLA_ESCOLHA)
  const tipo = typeof o.tipo === 'string' ? o.tipo.toUpperCase() : null;
  if (tipo && tipo !== 'MULTIPLA_ESCOLHA') {
    return {
      decision: 'descartar',
      reason: `tipo não suportado: ${tipo}`,
      disciplinaNome,
      normalized: null,
      externalId,
      numero,
    };
  }

  // Gabarito: '?', vazio ou ausente → descarta (decisão do user)
  const gabarito =
    typeof o.gabarito === 'string' ? o.gabarito.trim().toUpperCase() : '';
  if (!gabarito || gabarito === '?' || gabarito === 'NULL') {
    return {
      decision: 'descartar',
      reason: 'gabarito ausente (marca "?" no JSON)',
      disciplinaNome,
      normalized: null,
      externalId,
      numero,
    };
  }

  // Alternativas
  if (!Array.isArray(o.alternativas) || o.alternativas.length < 2) {
    return {
      decision: 'descartar',
      reason: 'alternativas ausentes ou < 2',
      disciplinaNome,
      normalized: null,
      externalId,
      numero,
    };
  }

  const alternativas: Alternativa[] = [];
  for (const altRaw of o.alternativas) {
    if (!altRaw || typeof altRaw !== 'object') continue;
    const alt = altRaw as Record<string, unknown>;
    const letra = typeof alt.letra === 'string' ? alt.letra.trim() : '';
    const texto = typeof alt.texto === 'string' ? alt.texto : '';
    if (!letra || !texto.trim()) continue;
    alternativas.push({
      letra: letra.toUpperCase(),
      texto,
      correta: letra.toUpperCase() === gabarito,
    });
  }
  if (alternativas.length < 2) {
    return {
      decision: 'descartar',
      reason: 'após filtro, sobraram <2 alternativas válidas',
      disciplinaNome,
      normalized: null,
      externalId,
      numero,
    };
  }
  // Garante que pelo menos uma está marcada correta (deveria, mas defesa)
  if (!alternativas.some((a) => a.correta)) {
    return {
      decision: 'descartar',
      reason: `gabarito "${gabarito}" não corresponde a nenhuma alternativa`,
      disciplinaNome,
      normalized: null,
      externalId,
      numero,
    };
  }

  const enunciado = typeof o.enunciado === 'string' ? o.enunciado : '';
  if (!enunciado.trim()) {
    return {
      decision: 'descartar',
      reason: 'enunciado vazio',
      disciplinaNome,
      normalized: null,
      externalId,
      numero,
    };
  }

  // Política do user (revisada): anuladas, desatualizadas e com hint de
  // imagem são DESCARTADAS na importação. Antes vinham marcadas como
  // duvidosa, mas o user prefere banco limpo — não vale poluir com
  // questões que vão precisar revisão e podem nem ser viáveis (imagem
  // ausente, gabarito incerto, etc).
  const isAnulada = o.anulada === true;
  const isDesatualizada = o.desatualizada === true;
  const possivelImagem = hasImageHint(enunciado);
  if (isAnulada) {
    return {
      decision: 'descartar',
      reason: 'questão anulada na prova original (anulada=true)',
      disciplinaNome,
      normalized: null,
      externalId,
      numero,
    };
  }
  if (isDesatualizada) {
    return {
      decision: 'descartar',
      reason: 'questão marcada como desatualizada (desatualizada=true)',
      disciplinaNome,
      normalized: null,
      externalId,
      numero,
    };
  }
  if (possivelImagem) {
    return {
      decision: 'descartar',
      reason:
        'enunciado menciona figura/tabela/gráfico que não está no JSON',
      disciplinaNome,
      normalized: null,
      externalId,
      numero,
    };
  }

  const verificacao = 'pendente';

  // Fonte: junta tudo que vem do JSON real
  const fonte: QuestionFonte = {};
  if (typeof o.banca === 'string') fonte.banca = o.banca;
  if (typeof o.concursoAno === 'number') fonte.ano = o.concursoAno;
  if (typeof o.orgao === 'string') fonte.orgao = o.orgao;
  if (typeof o.orgaoNome === 'string') fonte.orgao_nome = o.orgaoNome;
  if (typeof o.cargo === 'string') fonte.cargo = o.cargo;
  if (externalId !== null) fonte.external_id = externalId;
  if (typeof o.concursoArea === 'string') fonte.prova = o.concursoArea;

  // Tema vem de assunto
  const tema =
    typeof o.assunto === 'string' && o.assunto.trim() ? o.assunto.trim() : null;

  const payload: ObjetivaPayload = {
    enunciado,
    alternativas,
    gabarito,
  };

  // Preserva campos opcionais ricos do JSON real quando presentes
  if (typeof o.explicacao_geral === 'string' && o.explicacao_geral.trim()) {
    payload.explicacao_geral = o.explicacao_geral;
  }
  if (typeof o.concursoEdicao === 'string' && o.concursoEdicao.trim()) {
    fonte.edicao = o.concursoEdicao.replace(/^"|"$/g, '');
  }

  return {
    decision: 'importar',
    reason: 'ok',
    disciplinaNome,
    normalized: {
      type: 'objetiva',
      disciplina_id: disciplinaNome,
      tema,
      banca_estilo: typeof o.banca === 'string' ? o.banca : null,
      dificuldade: null,
      payload,
      srs: newSRS(),
      stats: newStats(),
      deleted_at: null,
      origem: 'real',
      fonte,
      verificacao,
    },
    externalId,
    numero,
  };
}

// =====================================================================
// Fuzzy match de disciplinas (Jaccard de tokens)
// =====================================================================

const STOPWORDS = new Set([
  'de',
  'do',
  'da',
  'dos',
  'das',
  'e',
  'a',
  'o',
  'as',
  'os',
  'em',
  'na',
  'no',
  'ti', // 'TI - X' é prefixo comum em QConcursos, ignorar
  'para',
  'com',
  'por',
]);

/**
 * Tokeniza string pra fuzzy match: lowercase, remove acentos,
 * separa em palavras, remove stopwords e tokens curtos.
 */
export function tokenize(s: string): Set<string> {
  if (!s) return new Set();
  const normalized = s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // remove diacríticos (acentos)
    .replace(/[_\-/]/g, ' ') // separadores
    .replace(/[^a-z0-9\s]/g, ' '); // tudo que não é alfanumérico vira espaço
  const tokens = new Set<string>();
  for (const tok of normalized.split(/\s+/)) {
    if (tok.length < 3) continue;
    if (STOPWORDS.has(tok)) continue;
    tokens.add(tok);
  }
  return tokens;
}

/**
 * Similaridade Jaccard entre dois conjuntos de tokens. 0 = nada em
 * comum, 1 = idênticos. Para nossos pares "TI - Ciência de Dados e
 * Inteligência Artificial" vs "inteligencia_artificial", o threshold
 * empírico de ~0.3 funciona bem.
 */
export function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1;
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const t of a) if (b.has(t)) inter++;
  const union = a.size + b.size - inter;
  return union === 0 ? 0 : inter / union;
}

// =====================================================================
// Parse de batch (combina autoral + real num único caminho)
// =====================================================================

export type NormalizedItem = Omit<
  Question,
  'id' | 'user_id' | 'created_at' | 'updated_at'
> & {
  payload: ObjetivaPayload | DiscursivaPayload;
};

export type BatchParseResult = {
  /** Itens prontos pra import (já passaram dedup contra DB existente). */
  toImport: NormalizedItem[];
  /** Reais descartadas (com motivo). */
  realDiscarded: ParsedRealItem[];
  /** Autorais que falharam validação. */
  autoralErrors: string[];
  /** Itens com formato não detectável. */
  unknownCount: number;
  /** Duplicatas com algo já no banco (conta separada). */
  duplicateInDbCount: number;
  /** Duplicatas dentro do próprio batch (ex: arquivo tem mesma questão 2x). */
  duplicateInBatchCount: number;
  /** Nomes únicos de disciplina detectados nos itens a importar. */
  novasDisciplinaNomes: string[];
  /** Quantos itens de cada formato. */
  realCount: number;
  autoralCount: number;
};

/**
 * Parse + dedup + classificação de um batch de itens.
 *
 * NÃO grava nada. Caller usa BatchParseResult pra montar UI de preview
 * + mapping de disciplinas e depois chama applyMappingAndImport.
 */
export function parseImportBatch(
  rawText: string,
  existingDedupeKeys: Set<string>
): { ok: BatchParseResult; error?: never } | { ok?: never; error: string } {
  const { value, error } = safeParseJSON(rawText);
  if (error) return { error: 'JSON inválido: ' + error };
  const items = extractItems(value);
  if (items.length === 0) return { error: 'Nenhum item encontrado' };

  const result: BatchParseResult = {
    toImport: [],
    realDiscarded: [],
    autoralErrors: [],
    unknownCount: 0,
    duplicateInDbCount: 0,
    duplicateInBatchCount: 0,
    novasDisciplinaNomes: [],
    realCount: 0,
    autoralCount: 0,
  };

  const seenInBatch = new Set<string>();
  const novasDisciplinasSet = new Set<string>();

  items.forEach((raw, idx) => {
    const fmt = detectFormat(raw);

    if (fmt === 'real') {
      result.realCount += 1;
      const parsed = parseRealItem(raw);
      if (parsed.decision === 'descartar') {
        result.realDiscarded.push(parsed);
        return;
      }
      const norm = parsed.normalized!;
      const k = dedupeKey(norm);
      if (existingDedupeKeys.has(k)) {
        result.duplicateInDbCount += 1;
        return;
      }
      if (seenInBatch.has(k)) {
        result.duplicateInBatchCount += 1;
        return;
      }
      seenInBatch.add(k);
      result.toImport.push(norm);
      if (parsed.disciplinaNome) novasDisciplinasSet.add(parsed.disciplinaNome);
    } else if (fmt === 'autoral') {
      result.autoralCount += 1;
      const v = validateQuestion(raw);
      if (!v.ok) {
        result.autoralErrors.push(`Item #${idx + 1}: ${v.errors.join(' | ')}`);
        return;
      }
      const norm = normalizeQuestion(raw as Record<string, unknown>, v.type);
      const k = dedupeKey(norm);
      if (existingDedupeKeys.has(k)) {
        result.duplicateInDbCount += 1;
        return;
      }
      if (seenInBatch.has(k)) {
        result.duplicateInBatchCount += 1;
        return;
      }
      seenInBatch.add(k);
      result.toImport.push(norm);
      if (norm.disciplina_id) novasDisciplinasSet.add(norm.disciplina_id);
    } else {
      result.unknownCount += 1;
    }
  });

  result.novasDisciplinaNomes = Array.from(novasDisciplinasSet);
  return { ok: result };
}

/**
 * Aplica um mapeamento de disciplinas (nomeOriginal → nomeFinal) à
 * lista de itens a importar. Útil quando o user decidiu fundir
 * "TI - Ciência..." → "inteligencia_artificial" no wizard.
 *
 * Os nomes de origem e destino são case-sensitive intencionalmente —
 * a UI controla isso (mapping é gerado via lookup case-insensitive
 * mas as strings finais devem matchar `disciplinas.nome` exato).
 */
export function applyDisciplinaMapping(
  items: NormalizedItem[],
  mapping: Map<string, string>
): NormalizedItem[] {
  if (mapping.size === 0) return items;
  return items.map((item) => {
    if (!item.disciplina_id) return item;
    const replacement = mapping.get(item.disciplina_id);
    if (!replacement) return item;
    return { ...item, disciplina_id: replacement };
  });
}

export type DisciplinaMappingSuggestion = {
  /** Nome da disciplina nova detectada no JSON. */
  novoNome: string;
  /** Sugestão automática: id da disciplina existente que mais combina,
   *  ou null se nenhuma passa do threshold. */
  sugestaoExistenteId: string | null;
  sugestaoExistenteNome: string | null;
  /** Score 0-1 da sugestão (pra UI mostrar quão confiante). */
  score: number;
};

/**
 * Pra cada nome novo (não-coincidente case-insensitive com algum
 * existente), sugere o melhor match dentre os existentes.
 *
 * Threshold default 0.3 — pareamento do tipo "TI - Ciência de Dados
 * e Inteligência Artificial" (5 tokens úteis) com "inteligencia
 * artificial" (2 tokens) tem Jaccard 2/5 = 0.4. Casos mais óbvios
 * tipo "Banco de Dados" (2 tokens) vs "banco_de_dados" (2 tokens)
 * = 1.0 (ambas tokenizam pra {banco, dados}).
 */
export function suggestDisciplinaMapping(
  novosNomes: string[],
  existentes: Array<{ id: string; nome: string }>,
  threshold = 0.3
): DisciplinaMappingSuggestion[] {
  const existentesLower = new Set(
    existentes.map((d) => d.nome.toLowerCase().trim())
  );

  // Dedup case-insensitive dos novos, e remove os que JÁ existem por nome exato
  const novos = new Map<string, string>();
  for (const n of novosNomes) {
    const t = n.trim();
    if (!t) continue;
    if (existentesLower.has(t.toLowerCase())) continue; // já existe, sem sugestão
    if (!novos.has(t.toLowerCase())) novos.set(t.toLowerCase(), t);
  }

  const tokensExist = existentes.map((d) => ({
    id: d.id,
    nome: d.nome,
    tokens: tokenize(d.nome),
  }));

  const out: DisciplinaMappingSuggestion[] = [];
  for (const novoNome of novos.values()) {
    const tokensNovo = tokenize(novoNome);
    let bestId: string | null = null;
    let bestNome: string | null = null;
    let bestScore = 0;
    for (const ex of tokensExist) {
      const s = jaccardSimilarity(tokensNovo, ex.tokens);
      if (s > bestScore) {
        bestScore = s;
        bestId = ex.id;
        bestNome = ex.nome;
      }
    }
    if (bestScore < threshold) {
      bestId = null;
      bestNome = null;
    }
    out.push({
      novoNome,
      sugestaoExistenteId: bestId,
      sugestaoExistenteNome: bestNome,
      score: bestScore,
    });
  }
  return out;
}
