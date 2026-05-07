import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearChatHistory,
  getChatHistory,
  historyToPrompt,
  saveChatHistory,
} from '../question-chat';

describe('question-chat', () => {
  let store: Record<string, string> = {};

  beforeEach(() => {
    store = {};
    vi.stubGlobal('window', {
      localStorage: {
        getItem: (k: string) => store[k] ?? null,
        setItem: (k: string, v: string) => {
          store[k] = v;
        },
        removeItem: (k: string) => {
          delete store[k];
        },
      },
    });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('getChatHistory: vazio inicialmente', () => {
    expect(getChatHistory('q1')).toEqual([]);
  });

  it('save + get roundtrip', () => {
    const msgs = [
      { role: 'user' as const, content: 'oi', timestamp: 1 },
      { role: 'assistant' as const, content: 'olá!', timestamp: 2 },
    ];
    saveChatHistory('q1', msgs);
    expect(getChatHistory('q1')).toEqual(msgs);
  });

  it('clear remove o histórico', () => {
    saveChatHistory('q1', [
      { role: 'user', content: 'x', timestamp: 1 },
    ]);
    expect(getChatHistory('q1').length).toBe(1);
    clearChatHistory('q1');
    expect(getChatHistory('q1')).toEqual([]);
  });

  it('histórico de outra questão é independente', () => {
    saveChatHistory('q1', [
      { role: 'user', content: 'A', timestamp: 1 },
    ]);
    saveChatHistory('q2', [
      { role: 'user', content: 'B', timestamp: 2 },
    ]);
    expect(getChatHistory('q1')[0]?.content).toBe('A');
    expect(getChatHistory('q2')[0]?.content).toBe('B');
  });

  it('filtra mensagens malformadas no get', () => {
    store['qc:q1'] = JSON.stringify([
      { role: 'user', content: 'ok', timestamp: 1 },
      { role: 'invalid', content: 'x', timestamp: 2 },
      { content: 'sem role', timestamp: 3 },
      'string solta',
    ]);
    expect(getChatHistory('q1').length).toBe(1);
  });

  it('JSON inválido → array vazio', () => {
    store['qc:q1'] = 'not json';
    expect(getChatHistory('q1')).toEqual([]);
  });

  it('trim ao MAX_TURNS (20 turns = 40 msgs)', () => {
    const msgs = [];
    for (let i = 0; i < 50; i++) {
      msgs.push({
        role: (i % 2 === 0 ? 'user' : 'assistant') as 'user' | 'assistant',
        content: `m${i}`,
        timestamp: i,
      });
    }
    saveChatHistory('q1', msgs);
    const got = getChatHistory('q1');
    expect(got.length).toBe(40); // últimos 40
    expect(got[0]?.content).toBe('m10'); // 50 - 40 = começa em 10
  });
});

describe('historyToPrompt', () => {
  it('inclui contexto + turns formatados', () => {
    const p = historyToPrompt(
      [
        { role: 'user', content: 'o que é X?', timestamp: 1 },
        { role: 'assistant', content: 'X é Y', timestamp: 2 },
        { role: 'user', content: 'mas e Z?', timestamp: 3 },
      ],
      'enunciado da questão'
    );
    expect(p).toContain('enunciado da questão');
    expect(p).toContain('Usuário: o que é X?');
    expect(p).toContain('Você: X é Y');
    expect(p).toContain('Usuário: mas e Z?');
  });

  it('histórico vazio: prompt ainda válido', () => {
    const p = historyToPrompt([], 'contexto');
    expect(p).toContain('contexto');
  });
});
