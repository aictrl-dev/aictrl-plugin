import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, readFile, mkdir, writeFile, stat } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { existsSync } from 'fs';
import { installClaudePlugin } from '../../src/writers/claude.js';
import type { WritableSkill } from '../../src/writers/shared.js';

describe('installClaudePlugin', () => {
  let tempHome: string;
  let pluginsRoot: string;
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
    pluginsRoot = join(tempHome, '.claude', 'plugins');
    pluginsCache = join(pluginsRoot, 'cache');
    settingsFile = join(tempHome, '.claude', 'settings.json');
  });

  afterEach(async () => {
    await rm(tempHome, { recursive: true });
  });

  // The canonical Claude Code layout puts plugins under
  // ~/.claude/plugins/marketplaces/<marketplace>/plugins/<plugin>/ so the
  // marketplace.json manifest can declare them via a relative "source" field.
  const pluginPath = (root: string, plugin = 'aictrl-talentrix') =>
    join(root, 'marketplaces', 'aictrl', 'plugins', plugin);

  it('creates plugin directory with correct structure', async () => {
    await installClaudePlugin({
      orgSlug: 'talentrix',
      skills,
      apiKey: 'sk_live_xxx',
      baseUrl: 'https://aictrl.dev',
      pluginsRoot,
      settingsFile,
    });

    const pluginDir = pluginPath(pluginsRoot);
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
      pluginsRoot,
      settingsFile,
    });

    const pluginJson = JSON.parse(
      await readFile(join(pluginPath(pluginsRoot), '.claude-plugin', 'plugin.json'), 'utf-8'),
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
      pluginsRoot,
      settingsFile,
    });

    const mcpJson = JSON.parse(
      await readFile(join(pluginPath(pluginsRoot), '.mcp.json'), 'utf-8'),
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
      pluginsRoot,
      settingsFile,
    });

    const settings = JSON.parse(await readFile(settingsFile, 'utf-8'));
    expect(settings.enabledPlugins['aictrl-talentrix@aictrl']).toBe(true);
  });

  it('preserves existing settings when merging', async () => {
    await mkdir(join(tempHome, '.claude'), { recursive: true });
    await writeFile(
      settingsFile,
      JSON.stringify({
        theme: 'dark',
        enabledPlugins: { 'other-plugin@market': true },
      }),
    );

    await installClaudePlugin({
      orgSlug: 'talentrix',
      skills,
      apiKey: 'sk_live_xxx',
      baseUrl: 'https://aictrl.dev',
      pluginsRoot,
      settingsFile,
    });

    const settings = JSON.parse(await readFile(settingsFile, 'utf-8'));
    expect(settings.theme).toBe('dark');
    expect(settings.enabledPlugins['other-plugin@market']).toBe(true);
    expect(settings.enabledPlugins['aictrl-talentrix@aictrl']).toBe(true);
  });

  it('registers PostToolUse Read hook in hooks.json', async () => {
    await installClaudePlugin({
      orgSlug: 'talentrix',
      skills,
      apiKey: 'sk_live_xxx',
      baseUrl: 'https://aictrl.dev',
      pluginsRoot,
      settingsFile,
    });

    const pluginDir = pluginPath(pluginsRoot);
    const pluginJson = JSON.parse(
      await readFile(join(pluginDir, '.claude-plugin', 'plugin.json'), 'utf-8'),
    );
    expect(pluginJson.hooks).toBe('./hooks/hooks.json');

    const hooksJson = JSON.parse(
      await readFile(join(pluginDir, 'hooks', 'hooks.json'), 'utf-8'),
    );
    const postToolUse = hooksJson.hooks.PostToolUse;
    expect(postToolUse).toHaveLength(1);
    expect(postToolUse[0].matcher).toBe('Read');
    expect(postToolUse[0].hooks[0]).toEqual({
      type: 'command',
      command: '${CLAUDE_PLUGIN_ROOT}/hooks/skill-telemetry.sh',
    });
    expect(existsSync(join(pluginDir, 'hooks', 'skill-telemetry.sh'))).toBe(true);
  });

  it('registers UserPromptSubmit slash-command hook in hooks.json', async () => {
    await installClaudePlugin({
      orgSlug: 'talentrix',
      skills,
      apiKey: 'sk_live_xxx',
      baseUrl: 'https://aictrl.dev',
      pluginsRoot,
      settingsFile,
    });

    const pluginDir = pluginPath(pluginsRoot);
    const hooksJson = JSON.parse(
      await readFile(join(pluginDir, 'hooks', 'hooks.json'), 'utf-8'),
    );

    expect(hooksJson.hooks.PostToolUse).toBeDefined();
    expect(hooksJson.hooks.UserPromptSubmit).toBeDefined();
    expect(hooksJson.hooks.UserPromptSubmit).toHaveLength(1);

    const userPromptSubmit = hooksJson.hooks.UserPromptSubmit[0];
    expect(userPromptSubmit.matcher).toBeUndefined();
    expect(userPromptSubmit.hooks[0]).toEqual({
      type: 'command',
      command: '${CLAUDE_PLUGIN_ROOT}/hooks/slash-command-telemetry.sh',
    });

    const slashHook = join(pluginDir, 'hooks', 'slash-command-telemetry.sh');
    expect(existsSync(slashHook)).toBe(true);

    const info = await stat(slashHook);
    expect(info.mode & 0o777).toBe(0o755);
  });

  it('clears old skills on re-install', async () => {
    await installClaudePlugin({
      orgSlug: 'talentrix',
      skills,
      apiKey: 'sk_live_xxx',
      baseUrl: 'https://aictrl.dev',
      pluginsRoot,
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
      pluginsRoot,
      settingsFile,
    });

    const pluginDir = pluginPath(pluginsRoot);
    expect(existsSync(join(pluginDir, 'skills', 'deploy', 'SKILL.md'))).toBe(true);
    expect(existsSync(join(pluginDir, 'skills', 'code-review'))).toBe(false);
  });

  // ---------------------------------------------------------------------------
  // Regression tests for #18 — plugin enablement without marketplace registration
  // ---------------------------------------------------------------------------
  // Before #18 was fixed, installClaudePlugin only wrote the plugin cache and
  // settings.enabledPlugins; it did NOT register the `aictrl` marketplace in
  // known_marketplaces.json or record the install in installed_plugins.json.
  // Claude Code then printed:
  //   "Plugin "aictrl-{orgSlug}" not found in marketplace "aictrl""
  // on every session because the marketplace name was unresolvable.

  it('writes marketplace manifest declaring the plugin', async () => {
    await installClaudePlugin({
      orgSlug: 'talentrix',
      skills,
      apiKey: 'sk_live_xxx',
      baseUrl: 'https://aictrl.dev',
      pluginsRoot,
      settingsFile,
    });

    const manifestPath = join(
      pluginsRoot,
      'marketplaces',
      'aictrl',
      '.claude-plugin',
      'marketplace.json',
    );
    expect(existsSync(manifestPath)).toBe(true);

    const manifest = JSON.parse(await readFile(manifestPath, 'utf-8'));
    expect(manifest.name).toBe('aictrl');
    expect(manifest.owner).toEqual({ name: 'aictrl' });
    expect(Array.isArray(manifest.plugins)).toBe(true);

    const plugin = manifest.plugins.find(
      (p: { name: string }) => p.name === 'aictrl-talentrix',
    );
    expect(plugin).toBeDefined();
    expect(plugin.source).toBe('./plugins/aictrl-talentrix');
    expect(plugin.version).toBe('1.0.0');
  });

  it('registers the marketplace in known_marketplaces.json', async () => {
    await installClaudePlugin({
      orgSlug: 'talentrix',
      skills,
      apiKey: 'sk_live_xxx',
      baseUrl: 'https://aictrl.dev',
      pluginsRoot,
      settingsFile,
    });

    const knownPath = join(pluginsRoot, 'known_marketplaces.json');
    expect(existsSync(knownPath)).toBe(true);

    const known = JSON.parse(await readFile(knownPath, 'utf-8'));
    expect(known.aictrl).toBeDefined();
    expect(known.aictrl.source).toEqual({
      source: 'local',
      path: join(pluginsRoot, 'marketplaces', 'aictrl'),
    });
    expect(known.aictrl.installLocation).toBe(
      join(pluginsRoot, 'marketplaces', 'aictrl'),
    );
    expect(typeof known.aictrl.lastUpdated).toBe('string');
  });

  it('preserves existing marketplaces when registering aictrl', async () => {
    await mkdir(pluginsRoot, { recursive: true });
    await writeFile(
      join(pluginsRoot, 'known_marketplaces.json'),
      JSON.stringify({
        'claude-plugins-official': {
          source: { source: 'github', repo: 'anthropics/claude-plugins-official' },
          installLocation: '/somewhere',
          lastUpdated: '2026-01-01T00:00:00.000Z',
        },
      }),
    );

    await installClaudePlugin({
      orgSlug: 'talentrix',
      skills,
      apiKey: 'sk_live_xxx',
      baseUrl: 'https://aictrl.dev',
      pluginsRoot,
      settingsFile,
    });

    const known = JSON.parse(
      await readFile(join(pluginsRoot, 'known_marketplaces.json'), 'utf-8'),
    );
    expect(known['claude-plugins-official']).toBeDefined();
    expect(known.aictrl).toBeDefined();
  });

  it('records the install in installed_plugins.json', async () => {
    await installClaudePlugin({
      orgSlug: 'talentrix',
      skills,
      apiKey: 'sk_live_xxx',
      baseUrl: 'https://aictrl.dev',
      pluginsRoot,
      settingsFile,
    });

    const installedPath = join(pluginsRoot, 'installed_plugins.json');
    expect(existsSync(installedPath)).toBe(true);

    const installed = JSON.parse(await readFile(installedPath, 'utf-8'));
    expect(installed.version).toBe(2);
    const entries = installed.plugins['aictrl-talentrix@aictrl'];
    expect(Array.isArray(entries)).toBe(true);
    expect(entries).toHaveLength(1);
    expect(entries[0].scope).toBe('user');
    expect(entries[0].installPath).toBe(pluginPath(pluginsRoot));
    expect(entries[0].version).toBe('1.0.0');
    expect(typeof entries[0].installedAt).toBe('string');
    expect(typeof entries[0].lastUpdated).toBe('string');
  });

  it('preserves installedAt across re-installs but updates lastUpdated', async () => {
    await installClaudePlugin({
      orgSlug: 'talentrix',
      skills,
      apiKey: 'sk_live_xxx',
      baseUrl: 'https://aictrl.dev',
      pluginsRoot,
      settingsFile,
    });

    const firstInstalled = JSON.parse(
      await readFile(join(pluginsRoot, 'installed_plugins.json'), 'utf-8'),
    );
    const firstInstalledAt = firstInstalled.plugins['aictrl-talentrix@aictrl'][0].installedAt;

    // Wait long enough for a distinct ISO timestamp on slower CI.
    await new Promise((resolve) => setTimeout(resolve, 10));

    await installClaudePlugin({
      orgSlug: 'talentrix',
      skills,
      apiKey: 'sk_live_xxx',
      baseUrl: 'https://aictrl.dev',
      pluginsRoot,
      settingsFile,
    });

    const secondInstalled = JSON.parse(
      await readFile(join(pluginsRoot, 'installed_plugins.json'), 'utf-8'),
    );
    const entry = secondInstalled.plugins['aictrl-talentrix@aictrl'][0];
    expect(entry.installedAt).toBe(firstInstalledAt);
    expect(entry.lastUpdated).not.toBe(firstInstalledAt);
  });

  it('cleans up legacy cache/<plugin>@aictrl/ directory from older installs', async () => {
    // Simulate a plugin previously installed by the pre-fix code path.
    const legacyDir = join(pluginsCache, 'aictrl-talentrix@aictrl');
    await mkdir(legacyDir, { recursive: true });
    await writeFile(join(legacyDir, 'STALE.md'), 'leftover from old installer');

    await installClaudePlugin({
      orgSlug: 'talentrix',
      skills,
      apiKey: 'sk_live_xxx',
      baseUrl: 'https://aictrl.dev',
      pluginsRoot,
      settingsFile,
    });

    expect(existsSync(legacyDir)).toBe(false);
    // And the canonical location is populated:
    expect(existsSync(join(pluginPath(pluginsRoot), '.claude-plugin', 'plugin.json'))).toBe(true);
  });
});
