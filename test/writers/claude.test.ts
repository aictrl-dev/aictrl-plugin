import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, readFile, mkdir, writeFile } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { existsSync } from 'fs';
import { installClaudePlugin } from '../../src/writers/claude.js';
import type { WritableSkill } from '../../src/writers/shared.js';

describe('installClaudePlugin', () => {
  let tempHome: string;
  let pluginsCache: string;
  let settingsFile: string;

  const skills: WritableSkill[] = [
    {
      name: 'code-review',
      markdown: '---\nname: code-review\n---\n\nReview code.',
      files: [],
    },
    {
      name: 'tdd',
      markdown: '---\nname: tdd\n---\n\nTDD guide.',
      files: [{ path: 'references/checklist.md', content: '# Checklist' }],
    },
  ];

  beforeEach(async () => {
    tempHome = await mkdtemp(join(tmpdir(), 'aictrl-test-'));
    pluginsCache = join(tempHome, '.claude', 'plugins', 'cache');
    settingsFile = join(tempHome, '.claude', 'settings.json');
  });

  afterEach(async () => {
    await rm(tempHome, { recursive: true });
  });

  it('creates plugin directory with correct structure', async () => {
    await installClaudePlugin({
      orgSlug: 'talentrix',
      skills,
      apiKey: 'sk_live_xxx',
      baseUrl: 'https://aictrl.dev',
      pluginsCache,
      settingsFile,
    });

    const pluginDir = join(pluginsCache, 'aictrl-talentrix@aictrl');
    expect(existsSync(join(pluginDir, '.claude-plugin', 'plugin.json'))).toBe(true);
    expect(existsSync(join(pluginDir, 'skills', 'code-review', 'SKILL.md'))).toBe(true);
    expect(existsSync(join(pluginDir, 'skills', 'tdd', 'SKILL.md'))).toBe(true);
    expect(existsSync(join(pluginDir, 'skills', 'tdd', 'references', 'checklist.md'))).toBe(true);
    expect(existsSync(join(pluginDir, '.mcp.json'))).toBe(true);
  });

  it('writes correct plugin.json', async () => {
    await installClaudePlugin({
      orgSlug: 'talentrix',
      skills,
      apiKey: 'sk_live_xxx',
      baseUrl: 'https://aictrl.dev',
      pluginsCache,
      settingsFile,
    });

    const pluginJson = JSON.parse(
      await readFile(join(pluginsCache, 'aictrl-talentrix@aictrl', '.claude-plugin', 'plugin.json'), 'utf-8')
    );
    expect(pluginJson.name).toBe('aictrl-talentrix');
    expect(pluginJson.mcpServers).toBe('./.mcp.json');
  });

  it('writes .mcp.json with correct MCP config', async () => {
    await installClaudePlugin({
      orgSlug: 'talentrix',
      skills,
      apiKey: 'sk_live_xxx',
      baseUrl: 'https://aictrl.dev',
      pluginsCache,
      settingsFile,
    });

    const mcpJson = JSON.parse(
      await readFile(join(pluginsCache, 'aictrl-talentrix@aictrl', '.mcp.json'), 'utf-8')
    );
    expect(mcpJson.mcpServers['aictrl-talentrix'].url).toBe('https://aictrl.dev/talentrix/mcp');
    expect(mcpJson.mcpServers['aictrl-talentrix'].headers.Authorization).toBe('Bearer sk_live_xxx');
  });

  it('registers plugin in settings.json', async () => {
    await installClaudePlugin({
      orgSlug: 'talentrix',
      skills,
      apiKey: 'sk_live_xxx',
      baseUrl: 'https://aictrl.dev',
      pluginsCache,
      settingsFile,
    });

    const settings = JSON.parse(await readFile(settingsFile, 'utf-8'));
    expect(settings.enabledPlugins['aictrl-talentrix@aictrl']).toBe(true);
  });

  it('preserves existing settings when merging', async () => {
    await mkdir(join(tempHome, '.claude'), { recursive: true });
    await writeFile(settingsFile, JSON.stringify({
      theme: 'dark',
      enabledPlugins: { 'other-plugin@market': true },
    }));

    await installClaudePlugin({
      orgSlug: 'talentrix',
      skills,
      apiKey: 'sk_live_xxx',
      baseUrl: 'https://aictrl.dev',
      pluginsCache,
      settingsFile,
    });

    const settings = JSON.parse(await readFile(settingsFile, 'utf-8'));
    expect(settings.theme).toBe('dark');
    expect(settings.enabledPlugins['other-plugin@market']).toBe(true);
    expect(settings.enabledPlugins['aictrl-talentrix@aictrl']).toBe(true);
  });

  it('clears old skills on re-install', async () => {
    await installClaudePlugin({
      orgSlug: 'talentrix',
      skills,
      apiKey: 'sk_live_xxx',
      baseUrl: 'https://aictrl.dev',
      pluginsCache,
      settingsFile,
    });

    const newSkills: WritableSkill[] = [
      { name: 'deploy', markdown: '---\nname: deploy\n---\n\nDeploy.', files: [] },
    ];

    await installClaudePlugin({
      orgSlug: 'talentrix',
      skills: newSkills,
      apiKey: 'sk_live_xxx',
      baseUrl: 'https://aictrl.dev',
      pluginsCache,
      settingsFile,
    });

    const pluginDir = join(pluginsCache, 'aictrl-talentrix@aictrl');
    expect(existsSync(join(pluginDir, 'skills', 'deploy', 'SKILL.md'))).toBe(true);
    expect(existsSync(join(pluginDir, 'skills', 'code-review'))).toBe(false);
  });
});
