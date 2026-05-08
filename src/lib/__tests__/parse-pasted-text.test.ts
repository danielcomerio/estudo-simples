import { describe, expect, it } from 'vitest';
import { parsePastedText, pastedToImportItem } from '../parse-pasted-text';

describe('parsePastedText', () => {
  it('extrai questão simples FGV-like', () => {
    const txt = `Sobre o art. 5º da CF/88, é correto afirmar:

A) é cláusula pétrea
B) pode ser revogado por EC
C) não se aplica a estrangeiros
D) só vale em estado de sítio
E) só vale em tempo de paz

Gabarito: A`;
    const r = parsePastedText(txt);
    expect(r).not.toBeNull();
    expect(r!.alternativas.length).toBe(5);
    expect(r!.gabarito).toBe('A');
    expect(r!.alternativas[0].correta).toBe(true);
    expect(r!.alternativas[1].correta).toBe(false);
    expect(r!.enunciado).toContain('art. 5º');
  });

  it('aceita formato (A) (B) (C)', () => {
    const txt = `Capital do Brasil:

(A) Rio
(B) São Paulo
(C) Brasília
(D) Salvador

Resposta: C`;
    const r = parsePastedText(txt);
    expect(r).not.toBeNull();
    expect(r!.gabarito).toBe('C');
    expect(r!.alternativas.length).toBe(4);
  });

  it('captura comentário/explicação', () => {
    const txt = `Pergunta?

A) errada
B) certa

Gabarito: B
Comentário: B é a correta porque...`;
    const r = parsePastedText(txt);
    expect(r).not.toBeNull();
    expect(r!.explicacao_geral).toContain('correta');
  });

  it('retorna null sem alternativas', () => {
    expect(parsePastedText('Só texto sem nada')).toBeNull();
  });

  it('retorna null com 1 alternativa só', () => {
    expect(parsePastedText('Pergunta\n\nA) só uma')).toBeNull();
  });

  it('retorna null pra string vazia/curta', () => {
    expect(parsePastedText('')).toBeNull();
    expect(parsePastedText('curto')).toBeNull();
  });
});

describe('pastedToImportItem', () => {
  it('converte pra formato autoral', () => {
    const parsed = {
      enunciado: 'Pergunta',
      alternativas: [
        { letra: 'A', texto: 'A1', correta: true },
        { letra: 'B', texto: 'B1' },
      ],
      gabarito: 'A',
      raw: 'raw',
    };
    const item = pastedToImportItem(parsed, 'Direito');
    expect(item.type).toBe('objetiva');
    expect(item.disciplina_id).toBe('Direito');
    expect(item.enunciado).toBe('Pergunta');
    expect(item.gabarito).toBe('A');
    expect(item.tags).toContain('parsed-pasted');
  });
});
