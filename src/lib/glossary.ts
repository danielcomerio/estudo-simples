/**
 * Glossário de termos técnicos do app. Usado pra tooltips em /manual,
 * /configuracoes e onde aparecer.
 *
 * Adicione termos conforme features novas precisarem de explicação.
 */

export type GlossaryEntry = {
  term: string;
  definition: string;
  category?: 'srs' | 'tipo' | 'integracao' | 'config' | 'workflow';
};

export const GLOSSARY: GlossaryEntry[] = [
  {
    term: 'SRS',
    definition:
      'Spaced Repetition System. Algoritmo que agenda revisões em intervalos crescentes pra otimizar retenção (Ebbinghaus).',
    category: 'srs',
  },
  {
    term: 'SM-2',
    definition:
      'Algoritmo SRS clássico do SuperMemo. Default do app. Bom pra começar.',
    category: 'srs',
  },
  {
    term: 'FSRS-6',
    definition:
      'Free Spaced Repetition Scheduler v6. Mais moderno e adaptativo que SM-2. Opt-in via /configuracoes.',
    category: 'srs',
  },
  {
    term: 'cloze',
    definition:
      'Tipo de questão com lacunas {{c1::resposta}} pra preencher. Estilo Anki cloze deletion.',
    category: 'tipo',
  },
  {
    term: 'flashcard',
    definition: 'Frente/verso simples — pergunta de um lado, resposta do outro.',
    category: 'tipo',
  },
  {
    term: 'discursiva',
    definition:
      'Questão sem alternativas, com espelho/rubrica pra autoavaliação.',
    category: 'tipo',
  },
  {
    term: 'objetiva',
    definition:
      'Questão de múltipla escolha (A-E), com gabarito e explicação por alternativa.',
    category: 'tipo',
  },
  {
    term: 'persona',
    definition:
      'Personalidade IA configurável (system prompt) — afeta tom e estilo das respostas IA em todo o app.',
    category: 'integracao',
  },
  {
    term: 'BYO key',
    definition:
      'Bring Your Own — você plugga sua própria chave OpenAI/Anthropic/Gemini. App é proxy, nunca armazena.',
    category: 'integracao',
  },
  {
    term: 'streak',
    definition:
      'Sequência de dias consecutivos estudando. Quebra se passar um dia sem questão respondida.',
    category: 'workflow',
  },
  {
    term: 'freeze',
    definition:
      'Gelo de streak. Protege contra 1 dia perdido. Ganha 1 a cada 7 dias seguidos + 1 por simulado.',
    category: 'workflow',
  },
  {
    term: 'mastery',
    definition:
      'Score 0-100 por disciplina = 70% acerto + 30% cobertura SRS. Badges Bronze/Prata/Ouro/Diamante.',
    category: 'workflow',
  },
  {
    term: 'interleaving',
    definition:
      'Misturar disciplinas durante a sessão (vs blocos). Melhora discriminação e retenção (Rohrer 2012).',
    category: 'workflow',
  },
  {
    term: 'active recall',
    definition:
      'Tentar lembrar antes de ver alternativas. Esconde opções até user clicar (toggle no /estudar config).',
    category: 'workflow',
  },
  {
    term: 'gabarito-ia',
    definition:
      'Tag automática em questões geradas por IA. Verificacao=pendente até user/IA validar.',
    category: 'workflow',
  },
];

export function lookupTerm(term: string): GlossaryEntry | null {
  const normalized = term.toLowerCase().trim();
  return (
    GLOSSARY.find((g) => g.term.toLowerCase() === normalized) ??
    GLOSSARY.find((g) => g.term.toLowerCase().includes(normalized)) ??
    null
  );
}

export function termsByCategory(category: GlossaryEntry['category']): GlossaryEntry[] {
  return GLOSSARY.filter((g) => g.category === category);
}
