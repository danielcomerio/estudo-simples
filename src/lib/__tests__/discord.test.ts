import { describe, expect, it } from 'vitest';
import { isValidDiscordWebhookUrl } from '../discord';

describe('isValidDiscordWebhookUrl', () => {
  it('aceita URL discord.com canônica', () => {
    expect(
      isValidDiscordWebhookUrl(
        'https://discord.com/api/webhooks/123456789/abcDEF-_xyz'
      )
    ).toBe(true);
  });

  it('aceita URL discordapp.com (alias legado)', () => {
    expect(
      isValidDiscordWebhookUrl(
        'https://discordapp.com/api/webhooks/123/abc-XYZ_test'
      )
    ).toBe(true);
  });

  it('rejeita http (não https)', () => {
    expect(
      isValidDiscordWebhookUrl('http://discord.com/api/webhooks/123/abc')
    ).toBe(false);
  });

  it('rejeita domínio diferente', () => {
    expect(
      isValidDiscordWebhookUrl('https://example.com/api/webhooks/123/abc')
    ).toBe(false);
  });

  it('rejeita path errado', () => {
    expect(
      isValidDiscordWebhookUrl('https://discord.com/something/123/abc')
    ).toBe(false);
  });

  it('rejeita non-string', () => {
    expect(isValidDiscordWebhookUrl(null)).toBe(false);
    expect(isValidDiscordWebhookUrl(undefined)).toBe(false);
    expect(isValidDiscordWebhookUrl(42)).toBe(false);
    expect(isValidDiscordWebhookUrl({})).toBe(false);
  });

  it('rejeita string vazia', () => {
    expect(isValidDiscordWebhookUrl('')).toBe(false);
  });

  it('rejeita channel_id não-numérico', () => {
    expect(
      isValidDiscordWebhookUrl(
        'https://discord.com/api/webhooks/abc/xyz'
      )
    ).toBe(false);
  });
});
