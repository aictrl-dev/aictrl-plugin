import { describe, it, expect, vi, afterEach } from 'vitest';
import { verifyApiKey } from '../src/verify.js';

describe('verifyApiKey', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('returns orgId on successful verification', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ verified: true, orgId: 'org-123' }),
    });

    const result = await verifyApiKey('https://aictrl.dev', 'sk_live_xxx');
    expect(result.verified).toBe(true);
    expect(result.orgId).toBe('org-123');
    expect(globalThis.fetch).toHaveBeenCalledWith(
      'https://aictrl.dev/api/telemetry/skill-usage/verify',
      expect.objectContaining({
        headers: expect.objectContaining({ 'X-API-Key': 'sk_live_xxx' }),
      }),
    );
  });

  it('throws on 401 (invalid key)', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: () => Promise.resolve({ error: 'Unauthorized' }),
    });

    await expect(verifyApiKey('https://aictrl.dev', 'bad-key'))
      .rejects.toThrow('Invalid API key');
  });

  it('throws on 403 (key not org-scoped)', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      json: () => Promise.resolve({ error: 'API_KEY_NOT_ORG_SCOPED' }),
    });

    await expect(verifyApiKey('https://aictrl.dev', 'sk_live_noscope'))
      .rejects.toThrow('API key is not scoped to an organization');
  });

  it('throws on network error', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('fetch failed'));

    await expect(verifyApiKey('https://aictrl.dev', 'sk_live_xxx'))
      .rejects.toThrow('fetch failed');
  });
});
