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
  let projectDir: string;
  let userSettingsFile: string;
  let projectSettingsFile: string;

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
    userSettingsFile = join(tempHome, '.claude', 'settings.json');
    projectDir = join(tempHome, 'project');
    projectSettingsFile = join(projectDir, '.claude', 'settings.local.json');
    await mkdir(projectDir, { recursive: true });
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
      projectDir,
      userSettingsFile,
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
      projectDir,
      userSettingsFile,
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
      projectDir,
      userSettingsFile,
    });

    const mcpJson = JSON.parse(
      await readFile(join(pluginPath(pluginsRoot), '.mcp.json'), 'utf-8'),
    );
    expect(mcpJson.mcpServers['aictrl-talentrix'].url).toBe('https://aictrl.dev/talentrix/mcp');
    expect(mcpJson.mcpServers['aictrl-talentrix'].headers.Authorization).toBe('Bearer sk_live_xxx');
  });

  it('enables plugin in project-scope settings.local.json', async () => {
    await installClaudePlugin({
      orgSlug: 'talentrix',
      skills,
      apiKey: 'sk_live_xxx',
      baseUrl: 'https://aictrl.dev',
      pluginsRoot,
      projectDir,
      userSettingsFile,
    });

    const projectSettings = JSON.parse(await readFile(projectSettingsFile, 'utf-8'));
    expect(projectSettings.enabledPlugins['aictrl-talentrix@aictrl']).toBe(true);
  });

  it('preserves existing entries in project settings.local.json when merging', async () => {
    await mkdir(join(projectDir, '.claude'), { recursive: true });
    await writeFile(
      projectSettingsFile,
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
      projectDir,
      userSettingsFile,
    });

    const projectSettings = JSON.parse(await readFile(projectSettingsFile, 'utf-8'));
    expect(projectSettings.theme).toBe('dark');
    expect(projectSettings.enabledPlugins['other-plugin@market']).toBe(true);
    expect(projectSettings.enabledPlugins['aictrl-talentrix@aictrl']).toBe(true);
  });

  it('registers PostToolUse Read hook in hooks.json', async () => {
    await installClaudePlugin({
      orgSlug: 'talentrix',
      skills,
      apiKey: 'sk_live_xxx',
      baseUrl: 'https://aictrl.dev',
      pluginsRoot,
      projectDir,
      userSettingsFile,
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
      projectDir,
      userSettingsFile,
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
      projectDir,
      userSettingsFile,
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
      projectDir,
      userSettingsFile,
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
      projectDir,
      userSettingsFile,
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
      projectDir,
      userSettingsFile,
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
      projectDir,
      userSettingsFile,
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
      projectDir,
      userSettingsFile,
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
      projectDir,
      userSettingsFile,
    });

    const firstInstalled = JSON.parse(
      await readFile(join(pluginsRoot, 'installed_plugins.json'), 'utf-8'),
    );
    const firstInstalledAt = firstInstalled.plugins['aictrl-talentrix@aictrl'][0].installedAt;

    // Force a clock advance so the second lastUpdated is provably later than
    // the first installedAt — robust against coarse-resolution timers on CI.
    await new Promise((resolve) => setTimeout(resolve, 10));

    await installClaudePlugin({
      orgSlug: 'talentrix',
      skills,
      apiKey: 'sk_live_xxx',
      baseUrl: 'https://aictrl.dev',
      pluginsRoot,
      projectDir,
      userSettingsFile,
    });

    const secondInstalled = JSON.parse(
      await readFile(join(pluginsRoot, 'installed_plugins.json'), 'utf-8'),
    );
    const entry = secondInstalled.plugins['aictrl-talentrix@aictrl'][0];
    expect(entry.installedAt).toBe(firstInstalledAt);
    expect(Date.parse(entry.lastUpdated)).toBeGreaterThanOrEqual(
      Date.parse(entry.installedAt),
    );
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
      projectDir,
      userSettingsFile,
    });

    expect(existsSync(legacyDir)).toBe(false);
    // And the canonical location is populated:
    expect(existsSync(join(pluginPath(pluginsRoot), '.claude-plugin', 'plugin.json'))).toBe(true);
  });

  // ---------------------------------------------------------------------------
  // Regression tests for PR #19 review feedback
  // ---------------------------------------------------------------------------

  it('rejects orgSlug containing path-traversal sequences', async () => {
    for (const bad of ['../evil', '../../escape', 'foo/bar', 'foo\\bar', 'foo bar', '', 'UPPER']) {
      await expect(
        installClaudePlugin({
          orgSlug: bad,
          skills,
          apiKey: 'sk_live_xxx',
          baseUrl: 'https://aictrl.dev',
          pluginsRoot,
          projectDir,
          userSettingsFile,
        }),
      ).rejects.toThrow(/Invalid orgSlug/);
    }
  });

  it('legacy cleanup is a no-op when the cache dir does not exist', async () => {
    // Pre-fix state is irrelevant for fresh installs — the rm({force:true})
    // path must not throw when there is nothing to remove.
    await expect(
      installClaudePlugin({
        orgSlug: 'talentrix',
        skills,
        apiKey: 'sk_live_xxx',
        baseUrl: 'https://aictrl.dev',
        pluginsRoot,
        projectDir,
        userSettingsFile,
      }),
    ).resolves.toBeUndefined();
  });

  it('does not pollute marketplace.json when the existing file is a JSON array', async () => {
    // Corrupt manifest (someone hand-edits the file into an array form).
    const manifestPath = join(
      pluginsRoot,
      'marketplaces',
      'aictrl',
      '.claude-plugin',
      'marketplace.json',
    );
    await mkdir(join(manifestPath, '..'), { recursive: true });
    await writeFile(manifestPath, JSON.stringify(['junk', 'array', 'content']));

    await installClaudePlugin({
      orgSlug: 'talentrix',
      skills,
      apiKey: 'sk_live_xxx',
      baseUrl: 'https://aictrl.dev',
      pluginsRoot,
      projectDir,
      userSettingsFile,
    });

    const manifest = JSON.parse(await readFile(manifestPath, 'utf-8'));
    // No numeric-indexed pollution from spreading an array as an object.
    expect(manifest['0']).toBeUndefined();
    expect(manifest['1']).toBeUndefined();
    expect(manifest.name).toBe('aictrl');
    expect(Array.isArray(manifest.plugins)).toBe(true);
    expect(manifest.plugins.find((p: { name: string }) => p.name === 'aictrl-talentrix')).toBeDefined();
  });

  it('does not lose the aictrl entry when known_marketplaces.json is a JSON array', async () => {
    await mkdir(pluginsRoot, { recursive: true });
    const knownPath = join(pluginsRoot, 'known_marketplaces.json');
    // Corrupt file in array shape — assigning `data[NAME] = {...}` to an
    // array would silently drop the named key on the next JSON.stringify.
    await writeFile(knownPath, JSON.stringify(['bogus']));

    await installClaudePlugin({
      orgSlug: 'talentrix',
      skills,
      apiKey: 'sk_live_xxx',
      baseUrl: 'https://aictrl.dev',
      pluginsRoot,
      projectDir,
      userSettingsFile,
    });

    const known = JSON.parse(await readFile(knownPath, 'utf-8'));
    expect(Array.isArray(known)).toBe(false);
    expect(known.aictrl).toBeDefined();
    expect(known.aictrl.installLocation).toBe(
      join(pluginsRoot, 'marketplaces', 'aictrl'),
    );
  });

  it('produces a self-consistent set of index files that Claude Code can resolve end-to-end', async () => {
    // This is the handshake Claude Code performs at load time:
    //   1. settings.enabledPlugins["<plugin>@<marketplace>"] is true
    //   2. known_marketplaces.json["<marketplace>"] points at a marketplace dir
    //   3. <marketplaceDir>/.claude-plugin/marketplace.json declares "<plugin>"
    //      with a "source" that resolves to a real plugin dir
    //   4. installed_plugins.json["<plugin>@<marketplace>"][user].installPath
    //      is the same plugin dir, which contains .claude-plugin/plugin.json
    //      whose "name" matches "<plugin>"
    // If any of these links drift (typo in marketplace name, wrong relative
    // source, mismatched pluginId vs pluginDirName), Claude Code prints the
    // exact "Plugin not found in marketplace aictrl" error that #18 was
    // about — but per-file tests still pass. This test closes that gap.
    await installClaudePlugin({
      orgSlug: 'talentrix',
      skills,
      apiKey: 'sk_live_xxx',
      baseUrl: 'https://aictrl.dev',
      pluginsRoot,
      projectDir,
      userSettingsFile,
    });

    // 1. enabledPlugins entry shape: "<plugin>@<marketplace>" — lives in
    // PROJECT-scope settings.local.json (one of the things #20 enforces).
    const settings = JSON.parse(await readFile(projectSettingsFile, 'utf-8'));
    const enabledKeys = Object.keys(settings.enabledPlugins).filter((k) =>
      k.startsWith('aictrl-talentrix@'),
    );
    expect(enabledKeys).toHaveLength(1);
    const [pluginAtMarketplace] = enabledKeys;
    const [pluginName, marketplaceName] = pluginAtMarketplace.split('@');

    // 2. known_marketplaces.json declares the same marketplace name
    const known = JSON.parse(
      await readFile(join(pluginsRoot, 'known_marketplaces.json'), 'utf-8'),
    );
    expect(known[marketplaceName]).toBeDefined();
    const marketplaceDir = known[marketplaceName].installLocation;
    expect(typeof marketplaceDir).toBe('string');
    expect(existsSync(marketplaceDir)).toBe(true);

    // 3. The marketplace manifest declares the plugin with a source path
    //    that resolves to a real plugin directory under the marketplace.
    const manifest = JSON.parse(
      await readFile(
        join(marketplaceDir, '.claude-plugin', 'marketplace.json'),
        'utf-8',
      ),
    );
    expect(manifest.name).toBe(marketplaceName);
    const pluginSpec = manifest.plugins.find(
      (p: { name: string }) => p.name === pluginName,
    );
    expect(pluginSpec).toBeDefined();
    expect(typeof pluginSpec.source).toBe('string');
    const resolvedPluginDir = join(marketplaceDir, pluginSpec.source);
    expect(existsSync(resolvedPluginDir)).toBe(true);

    // 4. installed_plugins.json points the user-scope install at the SAME
    //    directory, and that directory's plugin.json carries the same name.
    const installed = JSON.parse(
      await readFile(join(pluginsRoot, 'installed_plugins.json'), 'utf-8'),
    );
    const entries = installed.plugins[pluginAtMarketplace];
    const userEntry = entries.find((e: { scope: string }) => e.scope === 'user');
    expect(userEntry).toBeDefined();
    // Normalize both paths through `join` so trailing-slash differences don't
    // cause spurious failures across OSes.
    expect(join(userEntry.installPath)).toBe(join(resolvedPluginDir));

    const pluginJson = JSON.parse(
      await readFile(
        join(userEntry.installPath, '.claude-plugin', 'plugin.json'),
        'utf-8',
      ),
    );
    expect(pluginJson.name).toBe(pluginName);
  });

  it('preserves non-user-scope entries in installed_plugins.json across re-install', async () => {
    // Seed a project-scope install written by some future Claude Code version
    // (or another tool). The installer should only replace the user-scope row.
    await mkdir(pluginsRoot, { recursive: true });
    const installedPath = join(pluginsRoot, 'installed_plugins.json');
    const seed = {
      version: 2,
      plugins: {
        'aictrl-talentrix@aictrl': [
          {
            scope: 'project',
            installPath: '/some/project/path',
            version: '0.9.0',
            installedAt: '2026-01-01T00:00:00.000Z',
            lastUpdated: '2026-01-01T00:00:00.000Z',
          },
        ],
      },
    };
    await writeFile(installedPath, JSON.stringify(seed));

    await installClaudePlugin({
      orgSlug: 'talentrix',
      skills,
      apiKey: 'sk_live_xxx',
      baseUrl: 'https://aictrl.dev',
      pluginsRoot,
      projectDir,
      userSettingsFile,
    });

    const installed = JSON.parse(await readFile(installedPath, 'utf-8'));
    const entries = installed.plugins['aictrl-talentrix@aictrl'];
    expect(entries).toHaveLength(2);

    const project = entries.find((e: { scope: string }) => e.scope === 'project');
    expect(project).toBeDefined();
    expect(project.installPath).toBe('/some/project/path');
    expect(project.installedAt).toBe('2026-01-01T00:00:00.000Z');

    const user = entries.find((e: { scope: string }) => e.scope === 'user');
    expect(user).toBeDefined();
    expect(user.installPath).toBe(pluginPath(pluginsRoot));
    expect(user.version).toBe('1.0.0');
  });

  // ---------------------------------------------------------------------------
  // Regression tests for #20 — multi-org per-repo enablement
  // ---------------------------------------------------------------------------
  // The installer used to write enablement to user-scope ~/.claude/settings.json,
  // which meant every Claude Code session in every repo loaded *every* org's
  // MCP + skills. After #20 the enablement lives in project-scope
  // <projectDir>/.claude/settings.local.json so a developer with two orgs gets
  // only their current repo's plugin active.

  it('does not write any enablement entry to user-scope settings.json', async () => {
    await installClaudePlugin({
      orgSlug: 'talentrix',
      skills,
      apiKey: 'sk_live_xxx',
      baseUrl: 'https://aictrl.dev',
      pluginsRoot,
      projectDir,
      userSettingsFile,
    });

    // Either the file was never created, or — if it existed already — it has
    // no aictrl-* entries flipped on by this install.
    if (existsSync(userSettingsFile)) {
      const user = JSON.parse(await readFile(userSettingsFile, 'utf-8'));
      const aictrlKeys = Object.keys(user.enabledPlugins ?? {}).filter((k) =>
        k.startsWith('aictrl-'),
      );
      expect(aictrlKeys).toEqual([]);
    } else {
      expect(existsSync(userSettingsFile)).toBe(false);
    }
  });

  it('removes legacy user-scope enablement on upgrade and preserves unrelated entries', async () => {
    // Simulate a pre-#20 install: enablement landed in user-scope settings.json.
    await mkdir(join(tempHome, '.claude'), { recursive: true });
    await writeFile(
      userSettingsFile,
      JSON.stringify({
        enabledPlugins: {
          'aictrl-talentrix@aictrl': true,
          'feature-dev@claude-code-plugins': true, // unrelated, must stay
        },
        theme: 'dark',
      }),
    );

    await installClaudePlugin({
      orgSlug: 'talentrix',
      skills,
      apiKey: 'sk_live_xxx',
      baseUrl: 'https://aictrl.dev',
      pluginsRoot,
      projectDir,
      userSettingsFile,
    });

    const user = JSON.parse(await readFile(userSettingsFile, 'utf-8'));
    expect(user.enabledPlugins['aictrl-talentrix@aictrl']).toBeUndefined();
    expect(user.enabledPlugins['feature-dev@claude-code-plugins']).toBe(true);
    expect(user.theme).toBe('dark');

    // And the new project-scope location has it instead.
    const project = JSON.parse(await readFile(projectSettingsFile, 'utf-8'));
    expect(project.enabledPlugins['aictrl-talentrix@aictrl']).toBe(true);
  });

  it('does not touch unrelated aictrl-<other-org>@aictrl entries in user settings', async () => {
    // A developer who has talentrix installed at user scope (old installer)
    // and is now installing celliq in a different repo: the celliq install
    // should ONLY clean up celliq's own user-scope entry, not nuke talentrix's.
    await mkdir(join(tempHome, '.claude'), { recursive: true });
    await writeFile(
      userSettingsFile,
      JSON.stringify({
        enabledPlugins: {
          'aictrl-talentrix@aictrl': true,
        },
      }),
    );

    await installClaudePlugin({
      orgSlug: 'celliq',
      skills,
      apiKey: 'sk_live_xxx',
      baseUrl: 'https://aictrl.dev',
      pluginsRoot,
      projectDir,
      userSettingsFile,
    });

    const user = JSON.parse(await readFile(userSettingsFile, 'utf-8'));
    // talentrix entry survives — it'll get migrated when the user re-runs
    // the installer inside the talentrix repo.
    expect(user.enabledPlugins['aictrl-talentrix@aictrl']).toBe(true);
    expect(user.enabledPlugins['aictrl-celliq@aictrl']).toBeUndefined();
  });

  it('adds .claude/settings.local.json to project .gitignore', async () => {
    await installClaudePlugin({
      orgSlug: 'talentrix',
      skills,
      apiKey: 'sk_live_xxx',
      baseUrl: 'https://aictrl.dev',
      pluginsRoot,
      projectDir,
      userSettingsFile,
    });

    const gitignorePath = join(projectDir, '.gitignore');
    expect(existsSync(gitignorePath)).toBe(true);
    const gitignore = await readFile(gitignorePath, 'utf-8');
    expect(gitignore.split('\n').map((l) => l.trim())).toContain(
      '.claude/settings.local.json',
    );
  });

  it('multi-org: two project dirs each get only their own org enabled', async () => {
    const projectA = join(tempHome, 'celliq-repo');
    const projectB = join(tempHome, 'talentrix-repo');
    await mkdir(projectA, { recursive: true });
    await mkdir(projectB, { recursive: true });

    await installClaudePlugin({
      orgSlug: 'celliq',
      skills,
      apiKey: 'sk_celliq',
      baseUrl: 'https://aictrl.dev',
      pluginsRoot,
      projectDir: projectA,
      userSettingsFile,
    });

    await installClaudePlugin({
      orgSlug: 'talentrix',
      skills,
      apiKey: 'sk_talentrix',
      baseUrl: 'https://aictrl.dev',
      pluginsRoot,
      projectDir: projectB,
      userSettingsFile,
    });

    const settingsA = JSON.parse(
      await readFile(join(projectA, '.claude', 'settings.local.json'), 'utf-8'),
    );
    const settingsB = JSON.parse(
      await readFile(join(projectB, '.claude', 'settings.local.json'), 'utf-8'),
    );

    expect(settingsA.enabledPlugins['aictrl-celliq@aictrl']).toBe(true);
    expect(settingsA.enabledPlugins['aictrl-talentrix@aictrl']).toBeUndefined();

    expect(settingsB.enabledPlugins['aictrl-talentrix@aictrl']).toBe(true);
    expect(settingsB.enabledPlugins['aictrl-celliq@aictrl']).toBeUndefined();

    // Both plugins still coexist at the global install layer (so users can
    // switch repos without re-installing) — they're just not both enabled.
    const manifest = JSON.parse(
      await readFile(
        join(pluginsRoot, 'marketplaces', 'aictrl', '.claude-plugin', 'marketplace.json'),
        'utf-8',
      ),
    );
    const pluginNames = manifest.plugins.map((p: { name: string }) => p.name).sort();
    expect(pluginNames).toEqual(['aictrl-celliq', 'aictrl-talentrix']);
  });
});
