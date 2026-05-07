import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { streamAIChat } from '../ai-stream';

/**
 * Tests do parser SSE no client side. Mocka `fetch` retornando um
 * ReadableStream com chunks pré-definidos pra validar o pump correto.
 */

function makeSSEStream(chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      for (const c of chunks) controller.enqueue(encoder.encode(c));
      controller.close();
    },
  });
}

function mockFetch(body: ReadableStream<Uint8Array>, ok = true) {
  vi.stubGlobal(
    'fetch',
    vi.fn(() =>
      Promise.resolve(
        new Response(body, {
          status: ok ? 200 : 500,
          headers: { 'Content-Type': 'text/event-stream' },
        })
      )
    )
  );
}

describe('streamAIChat', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('agrega chunks consecutivos e chama onDone', async () => {
    mockFetch(
      makeSSEStream([
        'data: Olá\n\n',
        'data: , mundo\n\n',
        'data: !\n\n',
        'data: [DONE]\n\n',
      ])
    );
    const chunks: string[] = [];
    let done = false;
    await new Promise<void>((resolve) => {
      streamAIChat(
        { provider: 'openai', apiKey: 'sk-test123', prompt: 'oi' },
        {
          onChunk: (c) => chunks.push(c),
          onDone: () => {
            done = true;
            resolve();
          },
          onError: () => resolve(),
        }
      );
    });
    expect(chunks.join('')).toBe('Olá, mundo!');
    expect(done).toBe(true);
  });

  it('handle chunks fragmentados em buffer', async () => {
    // Simula chunk SSE quebrado entre 2 reads
    mockFetch(makeSSEStream(['data: par', 'te1\n\ndata: parte2\n\n', 'data: [DONE]\n\n']));
    const chunks: string[] = [];
    await new Promise<void>((resolve) => {
      streamAIChat(
        { provider: 'anthropic', apiKey: 'sk-ant-test123', prompt: 'x' },
        {
          onChunk: (c) => chunks.push(c),
          onDone: () => resolve(),
          onError: () => resolve(),
        }
      );
    });
    expect(chunks.join('')).toBe('parte1parte2');
  });

  it('chama onError em event: error', async () => {
    mockFetch(
      makeSSEStream(['event: error\ndata: rate_limit_exceeded\n\n'])
    );
    let errorMsg: string | null = null;
    await new Promise<void>((resolve) => {
      streamAIChat(
        { provider: 'gemini', apiKey: 'test1234567890ABC', prompt: 'x' },
        {
          onChunk: () => {},
          onDone: () => resolve(),
          onError: (msg) => {
            errorMsg = msg;
            resolve();
          },
        }
      );
    });
    expect(errorMsg).toBe('rate_limit_exceeded');
  });

  it('handle response não-ok', async () => {
    mockFetch(makeSSEStream(['boom']), false);
    let errorMsg: string | null = null;
    await new Promise<void>((resolve) => {
      streamAIChat(
        { provider: 'openai', apiKey: 'sk-test123', prompt: 'x' },
        {
          onChunk: () => {},
          onDone: () => resolve(),
          onError: (msg) => {
            errorMsg = msg;
            resolve();
          },
        }
      );
    });
    expect(errorMsg).toContain('boom');
  });

  it('AbortController cancela sem chamar onError', async () => {
    // Stream que fica aberto pra sempre
    const stream = new ReadableStream({
      start() {
        // nunca enqueue ou close
      },
    });
    mockFetch(stream);
    let errored = false;
    let donned = false;
    const ctrl = streamAIChat(
      { provider: 'openai', apiKey: 'sk-test123', prompt: 'x' },
      {
        onChunk: () => {},
        onDone: () => {
          donned = true;
        },
        onError: () => {
          errored = true;
        },
      }
    );
    // Aborta logo
    setTimeout(() => ctrl.abort(), 10);
    await new Promise((r) => setTimeout(r, 50));
    expect(errored).toBe(false);
    expect(donned).toBe(false);
  });
});
