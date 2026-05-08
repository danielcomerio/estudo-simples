/**
 * Dicionário canônico de tags conhecidas. Quando user importa ou cria
 * questão com tag, o app sugere a versão canônica se há matching.
 *
 * Categorias:
 *  - banca-* — bancas conhecidas (FGV, Cebraspe, FCC, etc)
 *  - origem — gabarito-ia, gabarito-oficial, gabarito-crowd
 *  - ano-* — ano da prova (2020, 2021, ...)
 *  - status-* — pendente, anulada, atualizada
 *  - dificuldade-* — facil, medio, dificil
 *  - foco — pegadinha, doutrina, jurisprudencia, lei-seca
 *
 * Helpers:
 *  - canonicalTag(input) → forma canônica conhecida (ou input slugified)
 *  - tagDescription(tag) → descrição amigável pra UI/tooltip
 *  - allKnownTags() → lista pra autocomplete
 */

import { normalizeTag } from './normalize';

type TagInfo = {
  canonical: string;
  description: string;
  category: 'banca' | 'origem' | 'ano' | 'status' | 'dificuldade' | 'foco' | 'tipo';
  aliases?: string[];
};

const BANCAS: TagInfo[] = [
  { canonical: 'banca-fgv', description: 'Banca FGV', category: 'banca', aliases: ['fgv', 'fundacao-getulio-vargas'] },
  { canonical: 'banca-cebraspe', description: 'Banca Cebraspe (ex-CESPE)', category: 'banca', aliases: ['cebraspe', 'cespe', 'banca-cespe'] },
  { canonical: 'banca-fcc', description: 'Banca FCC (Fundação Carlos Chagas)', category: 'banca', aliases: ['fcc'] },
  { canonical: 'banca-vunesp', description: 'Banca VUNESP', category: 'banca', aliases: ['vunesp'] },
  { canonical: 'banca-ibfc', description: 'Banca IBFC', category: 'banca', aliases: ['ibfc'] },
  { canonical: 'banca-quadrix', description: 'Banca Quadrix', category: 'banca', aliases: ['quadrix'] },
  { canonical: 'banca-aocp', description: 'Banca AOCP', category: 'banca', aliases: ['aocp'] },
  { canonical: 'banca-fepese', description: 'Banca FEPESE', category: 'banca', aliases: ['fepese'] },
  { canonical: 'banca-instituto-aocp', description: 'Banca Instituto AOCP', category: 'banca' },
  { canonical: 'banca-iades', description: 'Banca IADES', category: 'banca', aliases: ['iades'] },
  { canonical: 'banca-funcab', description: 'Banca FUNCAB', category: 'banca', aliases: ['funcab'] },
  { canonical: 'banca-consulplan', description: 'Banca CONSULPLAN', category: 'banca', aliases: ['consulplan'] },
  { canonical: 'banca-ipec', description: 'Banca IPEC', category: 'banca', aliases: ['ipec'] },
];

const ORIGEM: TagInfo[] = [
  {
    canonical: 'gabarito-ia',
    description: 'Gabarito gerado por IA — pendente validação humana',
    category: 'origem',
    aliases: ['ia', 'ai-generated', 'ai'],
  },
  {
    canonical: 'gabarito-oficial',
    description: 'Gabarito da banca/fonte oficial confirmado',
    category: 'origem',
    aliases: ['oficial', 'banca-confirmou'],
  },
  {
    canonical: 'gabarito-crowd',
    description: 'Gabarito validado coletivamente',
    category: 'origem',
    aliases: ['crowd', 'comunidade'],
  },
];

const STATUS: TagInfo[] = [
  { canonical: 'pendente', description: 'Aguardando revisão', category: 'status' },
  { canonical: 'anulada', description: 'Questão anulada pela banca', category: 'status' },
  { canonical: 'atualizada', description: 'Conteúdo desatualizado vs lei/jurisprudência atual', category: 'status' },
  { canonical: 'duvidosa', description: 'Gabarito controverso/duvidoso', category: 'status' },
  { canonical: 'erros-no-enunciado', description: 'Texto com erros de digitação/gramática', category: 'status' },
];

const DIFICULDADE: TagInfo[] = [
  { canonical: 'facil', description: 'Dificuldade fácil', category: 'dificuldade', aliases: ['easy', 'facil'] },
  { canonical: 'medio', description: 'Dificuldade média', category: 'dificuldade', aliases: ['medium', 'media'] },
  { canonical: 'dificil', description: 'Dificuldade difícil', category: 'dificuldade', aliases: ['hard', 'dificil'] },
];

const FOCO: TagInfo[] = [
  { canonical: 'pegadinha', description: 'Pegadinha clássica da banca', category: 'foco', aliases: ['armadilha', 'pegadinhas'] },
  { canonical: 'doutrina', description: 'Conceito doutrinário', category: 'foco' },
  { canonical: 'jurisprudencia', description: 'Jurisprudência STJ/STF/TST', category: 'foco', aliases: ['jurisprudencia', 'sumula'] },
  { canonical: 'lei-seca', description: 'Letra da lei pura', category: 'foco', aliases: ['lei', 'letra-da-lei'] },
  { canonical: 'caso-concreto', description: 'Aplicação a caso prático', category: 'foco', aliases: ['caso'] },
];

export const ALL_TAGS: TagInfo[] = [
  ...BANCAS,
  ...ORIGEM,
  ...STATUS,
  ...DIFICULDADE,
  ...FOCO,
];

const ALIAS_MAP: Map<string, TagInfo> = (() => {
  const m = new Map<string, TagInfo>();
  for (const t of ALL_TAGS) {
    m.set(t.canonical, t);
    for (const a of t.aliases ?? []) {
      m.set(normalizeTag(a), t);
    }
  }
  return m;
})();

/**
 * Recebe input livre, devolve a tag canônica conhecida se houver
 * matching exato/alias. Senão devolve a versão slugified do input.
 *
 * Exemplos:
 *   canonicalTag("FGV") → "banca-fgv"
 *   canonicalTag("ia") → "gabarito-ia"
 *   canonicalTag("art-5") → "art-5" (não está no dicionário, slugify)
 */
export function canonicalTag(input: string): string {
  const slug = normalizeTag(input);
  const known = ALIAS_MAP.get(slug);
  if (known) return known.canonical;
  return slug;
}

/**
 * Aplica canonicalTag em todas as tags da lista, preservando ordem
 * mas removendo duplicatas resultantes.
 */
export function canonicalizeTagList(tags: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const t of tags) {
    const c = canonicalTag(t);
    if (c && !seen.has(c)) {
      seen.add(c);
      out.push(c);
    }
  }
  return out;
}

export function tagDescription(tag: string): string | null {
  const info = ALIAS_MAP.get(normalizeTag(tag));
  return info?.description ?? null;
}

export function tagCategory(tag: string): TagInfo['category'] | null {
  const info = ALIAS_MAP.get(normalizeTag(tag));
  return info?.category ?? null;
}

export function allKnownTags(): TagInfo[] {
  return ALL_TAGS;
}
