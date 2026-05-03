import { describe, expect, it } from 'vitest';
import {
  detectFormat,
  hasImageHint,
  jaccardSimilarity,
  parseRealItem,
  suggestDisciplinaMapping,
  tokenize,
} from '../real-import';

const REAL_OK = {
  numero: 1,
  id: 12345,
  banca: 'FGV',
  orgao: 'MPE RJ',
  orgaoNome: 'Ministério Público do Estado do Rio de Janeiro',
  cargo: 'Analista',
  concursoAno: 2025,
  concursoArea: 'Administrativa',
  materia: 'Português',
  assunto: 'Crase',
  tipo: 'MULTIPLA_ESCOLHA',
  enunciado: 'Texto da questão sobre crase.',
  alternativas: [
    { letra: 'A', texto: 'opção A' },
    { letra: 'B', texto: 'opção B' },
    { letra: 'C', texto: 'opção C' },
    { letra: 'D', texto: 'opção D' },
    { letra: 'E', texto: 'opção E' },
  ],
  gabarito: 'C',
  anulada: false,
};

const AUTORAL_OK = {
  disciplina_id: 'portugues',
  tema: 'Crase',
  enunciado: 'Texto da autoral.',
  alternativas: [
    { letra: 'A', texto: 'a', correta: true },
    { letra: 'B', texto: 'b' },
  ],
  gabarito: 'A',
};

describe('detectFormat', () => {
  it('detecta real (QConcursos-like)', () => {
    expect(detectFormat(REAL_OK)).toBe('real');
  });
  it('detecta autoral (nosso formato)', () => {
    expect(detectFormat(AUTORAL_OK)).toBe('autoral');
  });
  it('unknown pra coisas estranhas', () => {
    expect(detectFormat(null)).toBe('unknown');
    expect(detectFormat([])).toBe('unknown');
    expect(detectFormat({ foo: 'bar' })).toBe('unknown');
  });
  it('autoral com disciplina_id mas sem alternativas ainda detecta autoral (validação posterior pega)', () => {
    expect(detectFormat({ disciplina_id: 'x' })).toBe('autoral');
  });
});

describe('hasImageHint', () => {
  it('detecta menções a figura/tabela/gráfico/imagem', () => {
    expect(hasImageHint('Observe a figura abaixo')).toBe(true);
    expect(hasImageHint('Conforme a tabela acima')).toBe(true);
    expect(hasImageHint('Veja o gráfico a seguir')).toBe(true);
    expect(hasImageHint('Examine a imagem')).toBe(true);
    expect(hasImageHint('No esquema seguinte')).toBe(true);
    expect(hasImageHint('A figura mostra')).toBe(true);
  });
  it('não detecta texto comum sem hint', () => {
    expect(hasImageHint('Qual alternativa correta sobre BI?')).toBe(false);
    expect(hasImageHint('')).toBe(false);
    expect(hasImageHint('Uma tabela é uma estrutura de dados')).toBe(false); // sem ref de localização
  });
});

describe('parseRealItem', () => {
  it('importa caso ok', () => {
    const r = parseRealItem(REAL_OK);
    expect(r.decision).toBe('importar');
    expect(r.normalized).not.toBeNull();
    expect(r.normalized?.origem).toBe('real');
    expect(r.normalized?.verificacao).toBe('pendente');
    expect(r.normalized?.disciplina_id).toBe('Português');
    expect(r.normalized?.tema).toBe('Crase');
    expect(r.normalized?.fonte?.banca).toBe('FGV');
    expect(r.normalized?.fonte?.ano).toBe(2025);
    expect(r.normalized?.fonte?.external_id).toBe(12345);
    expect(r.disciplinaNome).toBe('Português');
  });

  it('descarta gabarito ?', () => {
    const r = parseRealItem({ ...REAL_OK, gabarito: '?' });
    expect(r.decision).toBe('descartar');
    expect(r.reason).toMatch(/gabarito ausente/i);
    expect(r.normalized).toBeNull();
  });

  it('descarta gabarito vazio ou faltando', () => {
    expect(parseRealItem({ ...REAL_OK, gabarito: '' }).decision).toBe('descartar');
    const semGab = { ...REAL_OK };
    delete (semGab as Record<string, unknown>).gabarito;
    expect(parseRealItem(semGab).decision).toBe('descartar');
  });

  it('descarta tipo não suportado (DISCURSIVA, V_F)', () => {
    expect(parseRealItem({ ...REAL_OK, tipo: 'DISCURSIVA' }).decision).toBe('descartar');
    expect(parseRealItem({ ...REAL_OK, tipo: 'CERTO_ERRADO' }).decision).toBe('descartar');
  });

  it('descarta gabarito sem alternativa correspondente', () => {
    const r = parseRealItem({ ...REAL_OK, gabarito: 'Z' });
    expect(r.decision).toBe('descartar');
    expect(r.reason).toMatch(/não corresponde/i);
  });

  it('descarta se anulada=true (política revisada do user)', () => {
    const r = parseRealItem({ ...REAL_OK, anulada: true });
    expect(r.decision).toBe('descartar');
    expect(r.reason).toMatch(/anulada/i);
  });

  it('descarta se desatualizada=true', () => {
    const r = parseRealItem({ ...REAL_OK, desatualizada: true });
    expect(r.decision).toBe('descartar');
    expect(r.reason).toMatch(/desatualizada/i);
  });

  it('descarta se enunciado tem hint de imagem (sem imagem no JSON)', () => {
    const r = parseRealItem({
      ...REAL_OK,
      enunciado: 'Observe a figura abaixo e responda:',
    });
    expect(r.decision).toBe('descartar');
    expect(r.reason).toMatch(/figura|tabela|gr[áa]fico/i);
  });

  it('importa caso ok marca verificacao=pendente (gabarito ainda precisa confirmar)', () => {
    const r = parseRealItem(REAL_OK);
    expect(r.decision).toBe('importar');
    expect(r.normalized?.verificacao).toBe('pendente');
  });

  it('marca correta a alternativa que bate com gabarito', () => {
    const r = parseRealItem(REAL_OK);
    const alts = r.normalized?.payload.alternativas;
    expect(alts?.find((a) => a.letra === 'C')?.correta).toBe(true);
    expect(alts?.find((a) => a.letra === 'A')?.correta).toBe(false);
  });

  it('preserva external_id pra rastreabilidade', () => {
    const r = parseRealItem(REAL_OK);
    expect(r.externalId).toBe(12345);
    expect(r.normalized?.fonte?.external_id).toBe(12345);
  });

  it('descarta enunciado vazio', () => {
    const r = parseRealItem({ ...REAL_OK, enunciado: '   ' });
    expect(r.decision).toBe('descartar');
  });

  it('descarta alternativas <2', () => {
    const r = parseRealItem({
      ...REAL_OK,
      alternativas: [{ letra: 'A', texto: 'única' }],
    });
    expect(r.decision).toBe('descartar');
  });
});

describe('tokenize', () => {
  it('lowercase + sem acentos + sem stopwords', () => {
    const tokens = tokenize('TI - Ciência de Dados e Inteligência Artificial');
    expect(tokens.has('ciencia')).toBe(true);
    expect(tokens.has('dados')).toBe(true);
    expect(tokens.has('inteligencia')).toBe(true);
    expect(tokens.has('artificial')).toBe(true);
    expect(tokens.has('de')).toBe(false); // stopword
    expect(tokens.has('e')).toBe(false); // stopword
    expect(tokens.has('ti')).toBe(false); // stopword (prefixo comum)
  });
  it('separa por _ e -', () => {
    const tokens = tokenize('inteligencia_artificial');
    expect(tokens.has('inteligencia')).toBe(true);
    expect(tokens.has('artificial')).toBe(true);
    expect(tokens.size).toBe(2);
  });
  it('ignora tokens muito curtos', () => {
    const tokens = tokenize('a b cd ef ghi');
    expect(tokens.has('ghi')).toBe(true);
    expect(tokens.has('cd')).toBe(false);
    expect(tokens.has('ef')).toBe(false);
  });
  it('vazio → set vazio', () => {
    expect(tokenize('').size).toBe(0);
  });
});

describe('jaccardSimilarity', () => {
  it('idênticos = 1', () => {
    const a = tokenize('banco de dados');
    const b = tokenize('banco_de_dados');
    expect(jaccardSimilarity(a, b)).toBe(1);
  });
  it('disjuntos = 0', () => {
    const a = tokenize('matemática');
    const b = tokenize('química');
    expect(jaccardSimilarity(a, b)).toBe(0);
  });
  it('case real: TI - Ciência ... × inteligencia_artificial > threshold', () => {
    const a = tokenize('TI - Ciência de Dados e Inteligência Artificial');
    const b = tokenize('inteligencia_artificial');
    const s = jaccardSimilarity(a, b);
    expect(s).toBeGreaterThan(0.3);
    expect(s).toBeLessThan(1);
  });
});

describe('suggestDisciplinaMapping', () => {
  const existentes = [
    { id: 'd1', nome: 'inteligencia_artificial' },
    { id: 'd2', nome: 'banco_de_dados' },
    { id: 'd3', nome: 'portugues' },
  ];

  it('sugere match plausível por similaridade', () => {
    const mapping = suggestDisciplinaMapping(
      ['TI - Ciência de Dados e Inteligência Artificial'],
      existentes
    );
    expect(mapping).toHaveLength(1);
    expect(mapping[0].sugestaoExistenteId).toBe('d1');
    expect(mapping[0].score).toBeGreaterThan(0.3);
  });

  it('retorna sugestão null quando nada bate', () => {
    const mapping = suggestDisciplinaMapping(
      ['Direito Constitucional'],
      existentes
    );
    expect(mapping[0].sugestaoExistenteId).toBeNull();
  });

  it('exclui da sugestão nomes que já existem case-insensitive', () => {
    const mapping = suggestDisciplinaMapping(
      ['Portugues', 'PORTUGUES', 'portugues'],
      existentes
    );
    expect(mapping).toHaveLength(0);
  });

  it('dedup case-insensitive entre múltiplos novos', () => {
    const mapping = suggestDisciplinaMapping(
      ['Direito Penal', 'direito penal', 'DIREITO PENAL'],
      existentes
    );
    expect(mapping).toHaveLength(1);
  });
});
