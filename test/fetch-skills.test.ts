import { describe, it, expect, vi, afterEach } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { fetchMarketplace, fetchSkillContent, type MarketplaceSkill } from '../src/fetch-skills.js';

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
