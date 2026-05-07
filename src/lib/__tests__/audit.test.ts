import { describe, expect, it } from 'vitest';

/**
 * Tests pra extração de IP/UA do request — lógica embutida em audit().
 * Testamos a função pura aqui (replica) pra não mockar Supabase admin.
 */

function extractMeta(req: Request) {
  let ip: string | null = null;
  let ua: string | null = null;
  ip =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    req.headers.get('x-real-ip') ??
    null;
  ua = req.headers.get('user-agent') ?? null;
  if (ua && ua.length > 500) ua = ua.slice(0, 500);
  return { ip, ua };
}

function mkReq(headers: Record<string, string>): Request {
  return new Request('https://x.test', { headers });
}

describe('audit — extract IP/UA', () => {
  it('IP de x-forwarded-for (primeiro)', () => {
    const r = mkReq({ 'x-forwarded-for': '1.2.3.4, 5.6.7.8' });
    expect(extractMeta(r).ip).toBe('1.2.3.4');
  });

  it('IP de x-real-ip se forwarded ausente', () => {
    const r = mkReq({ 'x-real-ip': '9.9.9.9' });
    expect(extractMeta(r).ip).toBe('9.9.9.9');
  });

  it('IP null se ambos ausentes', () => {
    const r = mkReq({});
    expect(extractMeta(r).ip).toBe(null);
  });

  it('UA preservado', () => {
    const r = mkReq({ 'user-agent': 'Mozilla/5.0' });
    expect(extractMeta(r).ua).toBe('Mozilla/5.0');
  });

  it('UA truncado em 500 chars', () => {
    const long = 'A'.repeat(600);
    const r = mkReq({ 'user-agent': long });
    expect(extractMeta(r).ua?.length).toBe(500);
  });

  it('UA null se ausente', () => {
    const r = mkReq({});
    expect(extractMeta(r).ua).toBe(null);
  });

  it('whitespace em forwarded-for é trimado', () => {
    const r = mkReq({ 'x-forwarded-for': '  10.0.0.1  ,  10.0.0.2' });
    expect(extractMeta(r).ip).toBe('10.0.0.1');
  });
});
