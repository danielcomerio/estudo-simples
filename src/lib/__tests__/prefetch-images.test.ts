import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { prefetchUpcoming } from '../prefetch-images';
import type { Question } from '../types';

function mkQ(id: string, imgs?: string[]): Question {
  return {
    id,
    user_id: 'u',
    type: 'objetiva',
    payload: imgs ? { enunciado: 'X', imagens: imgs } : { enunciado: 'X' },
    srs: {
      dueDate: 0,
      repetitions: 0,
      easeFactor: 2.5,
      interval: 0,
      lastReviewed: null,
    },
    stats: { attempts: 0, correct: 0, wrong: 0, history: [] },
    disciplina_id: null,
    tema: null,
    banca_estilo: null,
    dificuldade: null,
    created_at: '',
    updated_at: '',
    deleted_at: null,
  } as Question;
}

describe('prefetchUpcoming', () => {
  let head: { appendChild: ReturnType<typeof vi.fn>; querySelectorAll: ReturnType<typeof vi.fn> };
  let createdLinks: HTMLLinkElement[];

  beforeEach(() => {
    createdLinks = [];
    head = {
      appendChild: vi.fn((el: HTMLLinkElement) => createdLinks.push(el)),
      querySelectorAll: vi.fn(() => [] as unknown as NodeListOf<Element>),
    };
    vi.stubGlobal('document', {
      head,
      querySelectorAll: head.querySelectorAll,
      createElement: () => {
        const el = {
          rel: '',
          as: '',
          href: '',
          crossOrigin: '',
          setAttribute: vi.fn(),
        } as unknown as HTMLLinkElement;
        return el;
      },
    });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('no-op se SSR (document undefined)', () => {
    vi.unstubAllGlobals();
    expect(() => prefetchUpcoming([], 0)).not.toThrow();
  });

  it('prefetch das próximas 3 questões com imagens', () => {
    const queue = [
      mkQ('current'),
      mkQ('next1', ['https://x.co/a.png']),
      mkQ('next2', ['https://x.co/b.png', 'https://x.co/c.png']),
      mkQ('next3', ['https://x.co/d.png']),
      mkQ('next4', ['https://x.co/e.png']), // fora do MAX_PREFETCH=3
    ];
    prefetchUpcoming(queue, 0);
    expect(head.appendChild).toHaveBeenCalledTimes(4); // a, b, c, d (não e)
  });

  it('skipa questões sem imagens', () => {
    const queue = [
      mkQ('cur'),
      mkQ('next1'), // sem imagens
      mkQ('next2', ['https://x.co/y.png']),
    ];
    prefetchUpcoming(queue, 0);
    expect(head.appendChild).toHaveBeenCalledTimes(1);
  });

  it('queue vazia → nada criado', () => {
    prefetchUpcoming([], 0);
    expect(head.appendChild).not.toHaveBeenCalled();
  });

  it('current no fim da queue → sem upcoming', () => {
    const queue = [mkQ('a', ['x.png']), mkQ('b', ['y.png'])];
    prefetchUpcoming(queue, 1);
    expect(head.appendChild).not.toHaveBeenCalled();
  });

  it('seta atributos corretos no link', () => {
    const queue = [mkQ('cur'), mkQ('n', ['https://x.co/img.png'])];
    prefetchUpcoming(queue, 0);
    const link = createdLinks[0];
    expect(link.rel).toBe('preload');
    expect(link.as).toBe('image');
    expect(link.href).toBe('https://x.co/img.png');
    expect(link.crossOrigin).toBe('anonymous');
  });
});
