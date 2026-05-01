import { describe, expect, it } from 'vitest';
import {
  HierarchyValidationError,
  validateConcursoInput,
  validateText,
  type ConcursoInput,
} from '../hierarchy';

describe('validateText', () => {
  it('campo undefined sem required passa', () => {
    expect(validateText('x', undefined, { max: 10 })).toBeNull();
  });

  it('campo undefined com required lança', () => {
    expect(() =>
      validateText('x', undefined, { max: 10, required: true })
    ).toThrow(HierarchyValidationError);
  });

  it('campo null sem required passa', () => {
    expect(validateText('x', null, { max: 10 })).toBeNull();
  });

  it('campo null com required lança', () => {
    expect(() =>
      validateText('x', null, { max: 10, required: true })
    ).toThrow(/obrigatório/);
  });

  it('whitespace tratado como vazio', () => {
    expect(validateText('x', '   ', { max: 10 })).toBeNull();
    expect(() =>
      validateText('x', '   ', { max: 10, required: true })
    ).toThrow(/obrigatório/);
  });

  it('respeita limite máximo (defesa contra payload abusivo)', () => {
    const longa = 'a'.repeat(201);
    expect(() => validateText('x', longa, { max: 200 })).toThrow(
      /máximo 200/
    );
  });

  it('rejeita tipo não-string (segurança contra input forjado)', () => {
    expect(() => validateText('x', 42, { max: 10 })).toThrow(
      /tipo inválido/
    );
    expect(() => validateText('x', {}, { max: 10 })).toThrow(/tipo inválido/);
    expect(() => validateText('x', [], { max: 10 })).toThrow(/tipo inválido/);
  });

  it('aplica pattern quando fornecido', () => {
    expect(() =>
      validateText('url', 'ftp://x', {
        max: 100,
        pattern: /^https?:\/\//,
        patternMsg: 'http obrigatório',
      })
    ).toThrow(/http obrigatório/);
    expect(
      validateText('url', 'https://x.com', {
        max: 100,
        pattern: /^https?:\/\//,
      })
    ).toBe('https://x.com');
  });

  it('faz trim antes de retornar', () => {
    expect(validateText('x', '  hi  ', { max: 10 })).toBe('hi');
  });
});

describe('validateConcursoInput', () => {
  const valido: ConcursoInput = { nome: 'TJ-RJ Analista' };

  it('aceita input mínimo', () => {
    expect(() => validateConcursoInput(valido)).not.toThrow();
  });

  it('aceita input completo', () => {
    expect(() =>
      validateConcursoInput({
        nome: 'TJ-RJ Analista',
        banca: 'FGV',
        orgao: 'TJ-RJ',
        cargo: 'Analista Judiciário',
        data_prova: '2026-08-15',
        status: 'ativo',
        edital_url: 'https://exemplo.com/edital.pdf',
        notas: 'observações aqui',
      })
    ).not.toThrow();
  });

  it('rejeita nome vazio', () => {
    expect(() => validateConcursoInput({ nome: '' })).toThrow(
      /nome.*obrigatório/
    );
    expect(() => validateConcursoInput({ nome: '   ' })).toThrow(
      /nome.*obrigatório/
    );
  });

  it('rejeita nome > 200 chars', () => {
    expect(() =>
      validateConcursoInput({ nome: 'x'.repeat(201) })
    ).toThrow(/nome.*máximo 200/);
  });

  it('rejeita banca > 100', () => {
    expect(() =>
      validateConcursoInput({ ...valido, banca: 'x'.repeat(101) })
    ).toThrow(/banca/);
  });

  it('rejeita notas > 10k', () => {
    expect(() =>
      validateConcursoInput({ ...valido, notas: 'x'.repeat(10_001) })
    ).toThrow(/notas/);
  });

  it('rejeita edital_url sem http(s)://', () => {
    expect(() =>
      validateConcursoInput({ ...valido, edital_url: 'javascript:alert(1)' })
    ).toThrow(/edital_url/);
    expect(() =>
      validateConcursoInput({ ...valido, edital_url: 'ftp://x' })
    ).toThrow(/edital_url/);
  });

  it('aceita edital_url http e https', () => {
    expect(() =>
      validateConcursoInput({ ...valido, edital_url: 'http://x.com/a' })
    ).not.toThrow();
    expect(() =>
      validateConcursoInput({ ...valido, edital_url: 'https://x.com/a' })
    ).not.toThrow();
  });

  it('aceita edital_url null/vazio sem validar pattern', () => {
    expect(() =>
      validateConcursoInput({ ...valido, edital_url: null })
    ).not.toThrow();
    expect(() =>
      validateConcursoInput({ ...valido, edital_url: '' })
    ).not.toThrow();
  });

  it('rejeita data_prova fora do formato YYYY-MM-DD', () => {
    expect(() =>
      validateConcursoInput({ ...valido, data_prova: '15/08/2026' })
    ).toThrow(/data_prova.*formato/);
    expect(() =>
      validateConcursoInput({ ...valido, data_prova: '2026/08/15' })
    ).toThrow(/data_prova/);
    expect(() =>
      validateConcursoInput({ ...valido, data_prova: '2026-8-15' })
    ).toThrow(/data_prova/);
  });

  it('rejeita data_prova com ano implausível', () => {
    expect(() =>
      validateConcursoInput({ ...valido, data_prova: '1900-01-01' })
    ).toThrow(/ano implausível/);
    expect(() =>
      validateConcursoInput({ ...valido, data_prova: '3000-01-01' })
    ).toThrow(/ano implausível/);
  });

  it('aceita data_prova null/vazia', () => {
    expect(() =>
      validateConcursoInput({ ...valido, data_prova: null })
    ).not.toThrow();
    expect(() =>
      validateConcursoInput({ ...valido, data_prova: '' })
    ).not.toThrow();
  });

  it('rejeita status inválido (defesa: input não-confiável de forms forjados)', () => {
    expect(() =>
      validateConcursoInput({
        ...valido,
        status: 'admin' as unknown as 'ativo',
      })
    ).toThrow(/status/);
  });

  it('aceita os 3 status válidos', () => {
    for (const s of ['ativo', 'arquivado', 'concluido'] as const) {
      expect(() =>
        validateConcursoInput({ ...valido, status: s })
      ).not.toThrow();
    }
  });

  it('rejeita campos com tipos não-string mesmo quando opcional', () => {
    expect(() =>
      validateConcursoInput({
        ...valido,
        banca: 42 as unknown as string,
      })
    ).toThrow(/banca.*tipo/);
  });
});
