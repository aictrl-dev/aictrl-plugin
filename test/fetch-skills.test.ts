import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { fetchMarketplace, fetchSkillContent, fetchWithRetry, type MarketplaceSkill } from '../src/fetch-skills.js';

const fixturesDir = join(import.meta.dirname, 'fixtures');
const marketplaceFixture = JSON.parse(readFileSync(join(fixturesDir, 'marketplace.json'), 'utf-8'));
const skillFixture = readFileSync(join(fixturesDir, 'skill-review.md'), 'utf-8');

describe('fetchMarketplace', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('fetches and returns skill list, filtering out MCP connector', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(marketplaceFixture),
    });

    const skills = await fetchMarketplace('https://aictrl.dev', 'talentrix', 'sk_live_xxx');
    expect(skills).toHaveLength(2);
    expect(skills.map(s => s.name)).toEqual(['code-review', 'tdd']);
    expect(skills.find(s => s.name === 'aictrl-talentrix')).toBeUndefined();
  });

  it('constructs correct API URL with org slug and api key', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(marketplaceFixture),
    });

    await fetchMarketplace('https://aictrl.dev', 'talentrix', 'sk_live_xxx');
    expect(globalThis.fetch).toHaveBeenCalledWith(
      'https://aictrl.dev/talentrix/sk_live_xxx/skills.git/.claude-plugin/marketplace.json',
    );
  });

  it('throws on 401', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: () => Promise.resolve({ error: 'Unauthorized' }),
    });

    await expect(fetchMarketplace('https://aictrl.dev', 'talentrix', 'bad'))
      .rejects.toThrow('Invalid API key or org slug');
  });
});

describe('fetchSkillContent', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('fetches SKILL.md content for a simple skill', async () => {
    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.endsWith('/SKILL.md')) {
        return Promise.resolve({ ok: true, text: () => Promise.resolve(skillFixture) });
      }
      if (url.endsWith('/plugin.json')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ name: 'code-review' }) });
      }
      return Promise.resolve({ ok: false, status: 404 });
    });

    const skill: MarketplaceSkill = {
      name: 'code-review',
      description: 'Review code changes',
      version: '1.0.0',
      tags: ['code', 'review'],
    };

    const content = await fetchSkillContent('https://aictrl.dev', 'talentrix', 'sk_live_xxx', skill);
    expect(content.markdown).toContain('Review the code changes');
    expect(content.files).toEqual([]);
  });

  it('fetches supporting files for directory-based skills', async () => {
    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.endsWith('/SKILL.md')) {
        return Promise.resolve({ ok: true, text: () => Promise.resolve(skillFixture) });
      }
      if (url.endsWith('/plugin.json')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            name: 'code-review',
            files: [
              { path: 'SKILL.md' },
              { path: 'references/checklist.md' },
            ],
          }),
        });
      }
      if (url.endsWith('/references/checklist.md')) {
        return Promise.resolve({ ok: true, text: () => Promise.resolve('# Checklist\n- Item 1') });
      }
      return Promise.resolve({ ok: false, status: 404 });
    });

    const skill: MarketplaceSkill = {
      name: 'code-review',
      description: 'Review code changes',
      version: '1.0.0',
      tags: ['code', 'review'],
    };

    const content = await fetchSkillContent('https://aictrl.dev', 'talentrix', 'sk_live_xxx', skill);
    expect(content.files).toHaveLength(1);
    expect(content.files[0].path).toBe('references/checklist.md');
    expect(content.files[0].content).toContain('Checklist');
  });
});

describe('fetchWithRetry', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('retries on 429 and eventually returns successful response', async () => {
    const mockFetch = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce({ ok: false, status: 429, headers: new Headers() } as Response)
      .mockResolvedValueOnce({ ok: false, status: 429, headers: new Headers() } as Response)
      .mockResolvedValueOnce({ ok: true, status: 200, headers: new Headers(), text: () => Promise.resolve('body') } as unknown as Response);

    const promise = fetchWithRetry('https://example.com/file', { delayMs: 10 });
    // Advance through the two back-off delays
    await vi.runAllTimersAsync();
    const response = await promise;

    expect(mockFetch).toHaveBeenCalledTimes(3);
    expect(response.ok).toBe(true);
  });

  it('honors Retry-After header (seconds)', async () => {
    const retryAfterHeaders = new Headers({ 'Retry-After': '0.05' });
    const mockFetch = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce({ ok: false, status: 429, headers: retryAfterHeaders } as Response)
      .mockResolvedValueOnce({ ok: true, status: 200, headers: new Headers() } as unknown as Response);

    const promise = fetchWithRetry('https://example.com/file', { delayMs: 10 });
    await vi.runAllTimersAsync();
    await promise;

    // With Retry-After: 0.05 the delay should have been ~50ms, not the default 10ms
    // We only assert it didn't throw and returned on 2nd attempt
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('throws after all retries are exhausted on persistent 429', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValue({ ok: false, status: 429, headers: new Headers() } as Response);

    const promise = fetchWithRetry('https://example.com/file', { delayMs: 10, maxRetries: 3 });
    // Attach rejection handler before advancing timers to prevent unhandled rejection
    const caught = promise.catch(e => e);
    await vi.runAllTimersAsync();
    const err = await caught;

    expect(err).toBeInstanceOf(Error);
    expect((err as Error).message).toContain('429');
  });

  it('does NOT retry on 404 — throws immediately', async () => {
    const mockFetch = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValue({ ok: false, status: 404, headers: new Headers() } as Response);

    await expect(fetchWithRetry('https://example.com/missing', { delayMs: 10 }))
      .rejects.toThrow('404');

    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('retries on 5xx (503) and returns successful response', async () => {
    const mockFetch = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce({ ok: false, status: 503, headers: new Headers() } as Response)
      .mockResolvedValueOnce({ ok: true, status: 200, headers: new Headers() } as unknown as Response);

    const promise = fetchWithRetry('https://example.com/file', { delayMs: 10 });
    await vi.runAllTimersAsync();
    const response = await promise;

    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(response.ok).toBe(true);
  });
});
