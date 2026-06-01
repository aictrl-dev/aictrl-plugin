import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, readFile, mkdir, writeFile, stat } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { existsSync } from 'fs';
import { installCodex } from '../../src/writers/codex.js';
import type { WritableSkill } from '../../src/writers/shared.js';

describe('installCodex', () => {
  let tempHome: string;
  let codexConfigFile: string;
  let codexMarketplaceFile: string;

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
    codexConfigFile = join(tempHome, '.codex', 'config.toml');
    codexMarketplaceFile = join(tempHome, '.agents', 'plugins', 'marketplace.json');
  });

  afterEach(async () => {
    await rm(tempHome, { recursive: true });
  });

  const pluginPath = (plugin = 'aictrl-talentrix') =>
    join(tempHome, '.agents', 'plugins', 'plugins', plugin);

  it('writes a Codex plugin with fetched skills', async () => {
    await installCodex({
      orgSlug: 'talentrix',
      skills,
      baseUrl: 'https://aictrl.dev',
      codexConfigFile,
      codexMarketplaceFile,
    });

    expect(existsSync(join(pluginPath(), '.codex-plugin', 'plugin.json'))).toBe(true);
    expect(existsSync(join(pluginPath(), 'skills', 'code-review', 'SKILL.md'))).toBe(true);
    expect(existsSync(join(pluginPath(), 'skills', 'tdd', 'references', 'checklist.md'))).toBe(true);

    const pluginJson = JSON.parse(
      await readFile(join(pluginPath(), '.codex-plugin', 'plugin.json'), 'utf-8'),
    );
    expect(pluginJson.name).toBe('aictrl-talentrix');
    expect(pluginJson.skills).toBe('./skills/');
    expect(pluginJson.interface.defaultPrompt).toHaveLength(2);
    expect(pluginJson.hooks).toBeUndefined();
    expect(pluginJson.mcpServers).toBeUndefined();
  });

  it('registers the plugin in the personal marketplace and preserves existing entries', async () => {
    await mkdir(join(codexMarketplaceFile, '..'), { recursive: true });
    await writeFile(
      codexMarketplaceFile,
      JSON.stringify({
        name: 'personal',
        interface: { displayName: 'My Plugins' },
        plugins: [
          {
            name: 'other-plugin',
            source: { source: 'local', path: './plugins/other-plugin' },
            policy: { installation: 'AVAILABLE', authentication: 'ON_INSTALL' },
            category: 'Productivity',
          },
        ],
      }),
    );

    await installCodex({
      orgSlug: 'talentrix',
      skills,
      baseUrl: 'https://aictrl.dev',
      codexConfigFile,
      codexMarketplaceFile,
    });

    const marketplace = JSON.parse(await readFile(codexMarketplaceFile, 'utf-8'));
    expect(marketplace.interface.displayName).toBe('My Plugins');
    expect(
      marketplace.plugins.find((p: { name: string }) => p.name === 'other-plugin'),
    ).toBeDefined();

    const aictrl = marketplace.plugins.find(
      (p: { name: string }) => p.name === 'aictrl-talentrix',
    );
    expect(aictrl).toEqual({
      name: 'aictrl-talentrix',
      source: { source: 'local', path: './plugins/aictrl-talentrix' },
      policy: { installation: 'INSTALLED_BY_DEFAULT', authentication: 'ON_USE' },
      category: 'Productivity',
    });
  });

  it('merges a bearer-token-env-var MCP server into existing Codex config', async () => {
    await mkdir(join(codexConfigFile, '..'), { recursive: true });
    await writeFile(
      codexConfigFile,
      [
        'model = "gpt-5-codex"',
        '',
        '[mcp_servers.other]',
        'url = "https://example.com/mcp"',
        '',
      ].join('\n'),
    );

    await installCodex({
      orgSlug: 'talentrix',
      skills,
      baseUrl: 'https://aictrl.dev',
      codexConfigFile,
      codexMarketplaceFile,
    });

    const config = await readFile(codexConfigFile, 'utf-8');
    expect(config).toContain('model = "gpt-5-codex"');
    expect(config).toContain('[mcp_servers.other]\nurl = "https://example.com/mcp"');
    expect(config).toContain('[mcp_servers.aictrl-talentrix]');
    expect(config).toContain('url = "https://aictrl.dev/talentrix/mcp"');
    expect(config).toContain('bearer_token_env_var = "AICTRL_API_KEY"');
    expect(config).not.toContain('sk_live');

    const mode = (await stat(codexConfigFile)).mode & 0o777;
    expect(mode).toBe(0o600);
  });

  it('updates only the aictrl MCP block on re-run', async () => {
    await mkdir(join(codexConfigFile, '..'), { recursive: true });
    await writeFile(
      codexConfigFile,
      [
        '[mcp_servers.aictrl-talentrix]',
        'url = "https://old.example/talentrix/mcp"',
        'bearer_token_env_var = "OLD_KEY"',
        '',
        '[mcp_servers.other]',
        'url = "https://example.com/mcp"',
        '',
      ].join('\n'),
    );

    await installCodex({
      orgSlug: 'talentrix',
      skills,
      baseUrl: 'https://aictrl.dev',
      codexConfigFile,
      codexMarketplaceFile,
    });
    await installCodex({
      orgSlug: 'talentrix',
      skills,
      baseUrl: 'https://aictrl.dev',
      codexConfigFile,
      codexMarketplaceFile,
    });

    const config = await readFile(codexConfigFile, 'utf-8');
    expect((config.match(/\[mcp_servers\.aictrl-talentrix\]/g) ?? [])).toHaveLength(1);
    expect(config).toContain('[mcp_servers.other]\nurl = "https://example.com/mcp"');
    expect(config).not.toContain('OLD_KEY');
  });

  it('clears only the managed plugin skills on re-install', async () => {
    await installCodex({
      orgSlug: 'talentrix',
      skills,
      baseUrl: 'https://aictrl.dev',
      codexConfigFile,
      codexMarketplaceFile,
    });

    const unrelatedPluginSkill = join(
      tempHome,
      '.agents',
      'plugins',
      'plugins',
      'other',
      'skills',
      'keep',
      'SKILL.md',
    );
    await mkdir(join(unrelatedPluginSkill, '..'), { recursive: true });
    await writeFile(unrelatedPluginSkill, 'keep');

    await installCodex({
      orgSlug: 'talentrix',
      skills: [{ name: 'deploy', markdown: 'Deploy.', files: [] }],
      baseUrl: 'https://aictrl.dev',
      codexConfigFile,
      codexMarketplaceFile,
    });

    expect(existsSync(join(pluginPath(), 'skills', 'deploy', 'SKILL.md'))).toBe(true);
    expect(existsSync(join(pluginPath(), 'skills', 'code-review'))).toBe(false);
    expect(existsSync(unrelatedPluginSkill)).toBe(true);
  });

  it('rejects unsafe org slugs', async () => {
    await expect(
      installCodex({
        orgSlug: '../evil',
        skills,
        baseUrl: 'https://aictrl.dev',
        codexConfigFile,
        codexMarketplaceFile,
      }),
    ).rejects.toThrow(/Invalid orgSlug/);
  });
});
