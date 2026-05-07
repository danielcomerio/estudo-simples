import { describe, expect, it } from 'vitest';
import { detectPlatform, inferDeviceLabel, validatePushPayload } from '../push';

describe('validatePushPayload', () => {
  it('aceita payload mínimo válido', () => {
    expect(
      validatePushPayload({ title: 'oi', body: 'corpo' })
    ).toEqual({ ok: true });
  });

  it('rejeita sem title', () => {
    expect(validatePushPayload({ body: 'x' }).ok).toBe(false);
    expect(validatePushPayload({ title: '', body: 'x' }).ok).toBe(false);
    expect(validatePushPayload({ title: '   ', body: 'x' }).ok).toBe(false);
  });

  it('rejeita sem body', () => {
    expect(validatePushPayload({ title: 'x' }).ok).toBe(false);
    expect(validatePushPayload({ title: 'x', body: '' }).ok).toBe(false);
  });

  it('rejeita title/body excessivos', () => {
    expect(
      validatePushPayload({ title: 'x'.repeat(201), body: 'y' }).ok
    ).toBe(false);
    expect(
      validatePushPayload({ title: 'y', body: 'x'.repeat(1001) }).ok
    ).toBe(false);
  });

  it('rejeita tipos inválidos', () => {
    expect(validatePushPayload(null).ok).toBe(false);
    expect(validatePushPayload(42).ok).toBe(false);
    expect(validatePushPayload({ title: 1, body: 'x' }).ok).toBe(false);
    expect(
      validatePushPayload({ title: 'x', body: 'y', url: 42 }).ok
    ).toBe(false);
  });

  it('aceita campos opcionais válidos', () => {
    expect(
      validatePushPayload({
        title: 'x',
        body: 'y',
        url: '/banco',
        tag: 'srs-due',
      }).ok
    ).toBe(true);
  });
});

describe('inferDeviceLabel', () => {
  it('detecta iPhone, Android, Mac, Windows', () => {
    expect(inferDeviceLabel('Mozilla iPhone')).toBe('iPhone');
    expect(inferDeviceLabel('Linux Android 13')).toBe('Android');
    expect(inferDeviceLabel('Mac OS X 10_15')).toBe('Mac');
    expect(inferDeviceLabel('Windows NT 10.0')).toBe('Windows');
  });

  it('iPad antes de Mac (preferência)', () => {
    // iPad Safari às vezes reporta como Macintosh — mas se aparece
    // 'ipad' explícito, preferimos.
    expect(inferDeviceLabel('iPad; Safari')).toBe('iPad');
  });

  it('null/empty: fallback', () => {
    expect(inferDeviceLabel(null)).toBe('Dispositivo desconhecido');
    expect(inferDeviceLabel('')).toBe('Dispositivo desconhecido');
  });

  it('UA estranho: Navegador genérico', () => {
    expect(inferDeviceLabel('CustomBot/1.0')).toBe('Navegador');
  });
});

describe('detectPlatform', () => {
  it('Capacitor iOS → apns', () => {
    expect(detectPlatform({ capacitorPlatform: 'ios' })).toBe('apns');
  });

  it('Capacitor Android → fcm', () => {
    expect(detectPlatform({ capacitorPlatform: 'android' })).toBe('fcm');
  });

  it('browser → web', () => {
    expect(detectPlatform({ userAgent: 'Mozilla' })).toBe('web');
    expect(detectPlatform({})).toBe('web');
  });

  it('priorize Capacitor sobre UA', () => {
    expect(
      detectPlatform({ capacitorPlatform: 'ios', userAgent: 'Mozilla iPhone' })
    ).toBe('apns');
  });
});
