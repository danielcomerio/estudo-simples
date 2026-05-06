/**
 * Dados estáticos de bancas e concursos pra geração de landing pages SEO.
 * Pode crescer conforme necessário — cada nova entrada vira uma página
 * dedicada em /concursos-populares/[slug].
 */

export type BancaInfo = {
  slug: string;
  nome: string;
  descricao: string;
  estilo: string;
  concursosExemplo: string[];
  dicas: string[];
  emoji: string;
};

export const BANCAS: BancaInfo[] = [
  {
    slug: 'fgv',
    nome: 'FGV',
    emoji: '📋',
    descricao:
      'Fundação Getulio Vargas é uma das bancas mais respeitadas em concursos federais e estaduais brasileiros, conhecida por questões interpretativas e textos longos.',
    estilo:
      'Questões objetivas com texto-base extenso, ênfase em raciocínio lógico e interpretação. Pegadinhas usuais em "sempre", "jamais", "exclusivamente". Tabela e gráficos frequentes.',
    concursosExemplo: [
      'Senado Federal',
      'TJ-SP, TJ-DFT, TJ-RS',
      'Banco do Brasil, Caixa',
      'Receita Federal',
      'Polícia Federal (parcial)',
    ],
    dicas: [
      'Pratique muito interpretação de texto — tem peso em quase toda prova FGV.',
      'Atenção a quantificadores ("apenas", "todos", "nenhum") em alternativas.',
      'Tempo médio por questão é apertado — treine com cronômetro no /simulado.',
      'Use a tag `banca:FGV` no /banco pra filtrar e revisar especificamente.',
    ],
  },
  {
    slug: 'cebraspe',
    nome: 'Cebraspe (CESPE)',
    emoji: '⚖',
    descricao:
      'Centro Brasileiro de Pesquisa em Avaliação. Conhecida pelo formato Certo/Errado em provas federais de alto nível (PF, PRF, INSS, MPU).',
    estilo:
      'Questões objetivas em formato Certo/Errado, com penalidade por erro (errar conta -1 ponto vs +1 do certo). Itens longos, técnicos. Doutrina e jurisprudência atualizadas.',
    concursosExemplo: [
      'Polícia Federal',
      'Polícia Rodoviária Federal',
      'INSS',
      'MPU, MP-DFT',
      'Tribunais Superiores (STF, STJ, TST)',
      'Receita Federal',
    ],
    dicas: [
      'Estratégia de marcação: só responda quando tiver convicção (errar -1).',
      'Treine certo/errado com nosso filtro de tipo `objetiva` + crie tags `banca:Cebraspe`.',
      'Memoriza palavras-chave de doutrina — Cebraspe troca uma palavra e a alternativa muda de certa pra errada.',
      'Simulado com cronômetro ajuda a calibrar quando deixar em branco.',
    ],
  },
  {
    slug: 'fcc',
    nome: 'FCC',
    emoji: '🏛',
    descricao:
      'Fundação Carlos Chagas. Banca tradicional de tribunais e órgãos administrativos. Conhecida por questões diretas, mas com pegadinhas em literalidade.',
    estilo:
      'Múltipla escolha (5 alternativas), questões mais diretas, mas detalhista em literalidade da lei. Atenção a "salvo", "exceto", "ressalvada".',
    concursosExemplo: [
      'TRT (vários estados)',
      'TRE-SP, TRE-RJ',
      'Manaus Energia',
      'DPE-SP',
      'Câmara Municipal SP',
    ],
    dicas: [
      'Memoriza redação literal de artigos da CF e leis-chave do edital.',
      'Use cloze cards (texto com lacunas) pra fixar artigos importantes.',
      'Questões discursivas FCC podem cobrar redação — use nosso /discursivas.',
      'Tag `banca:FCC` no banco facilita revisão segmentada.',
    ],
  },
  {
    slug: 'ibfc',
    nome: 'IBFC',
    emoji: '📚',
    descricao:
      'Instituto Brasileiro de Formação e Capacitação. Banca em ascensão em concursos municipais e estaduais.',
    estilo:
      'Múltipla escolha, dificuldade média. Questões podem variar muito de prova pra prova. Atualização do edital é crítica.',
    concursosExemplo: [
      'Concursos municipais (vários)',
      'INSS (em algumas edições)',
      'EBSERH (hospitais)',
      'Polícias civis estaduais',
    ],
    dicas: [
      'Atenção redobrada à atualidade do conteúdo — IBFC cobra novidades.',
      'Banco grande de questões anteriores é importante; use o import JSON do app.',
      'Simulados específicos da banca ajudam a entender padrão de prova.',
    ],
  },
];

export function getBancaBySlug(slug: string): BancaInfo | undefined {
  return BANCAS.find((b) => b.slug === slug);
}
