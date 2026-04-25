import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, readFile, mkdir, writeFile, stat } from 'fs/promises';
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

  it('registers PostToolUse Read hook in hooks.json', async () => {
    await installClaudePlugin({
      orgSlug: 'talentrix',
      skills,
      apiKey: 'sk_live_xxx',
      baseUrl: 'https://aictrl.dev',
      pluginsCache,
      settingsFile,
    });

    const pluginDir = join(pluginsCache, 'aictrl-talentrix@aictrl');
    const pluginJson = JSON.parse(
      await readFile(join(pluginDir, '.claude-plugin', 'plugin.json'), 'utf-8')
    );
    expect(pluginJson.hooks).toBe('./hooks/hooks.json');

    const hooksJson = JSON.parse(
      await readFile(join(pluginDir, 'hooks', 'hooks.json'), 'utf-8')
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
      pluginsCache,
      settingsFile,
    });

    const pluginDir = join(pluginsCache, 'aictrl-talentrix@aictrl');
    const hooksJson = JSON.parse(
      await readFile(join(pluginDir, 'hooks', 'hooks.json'), 'utf-8'),
    );

    expect(hooksJson.hooks.PostToolUse).toBeDefined();
    expect(hooksJson.hooks.UserPromptSubmit).toBeDefined();
    expect(hooksJson.hooks.UserPromptSubmit).toHaveLength(1);

    const userPromptSubmit = hooksJson.hooks.UserPromptSubmit[0];
    // No matcher field — UserPromptSubmit has no tool name to match.
    expect(userPromptSubmit.matcher).toBeUndefined();
    expect(userPromptSubmit.hooks[0]).toEqual({
      type: 'command',
      command: '${CLAUDE_PLUGIN_ROOT}/hooks/slash-command-telemetry.sh',
    });

    const slashHook = join(pluginDir, 'hooks', 'slash-command-telemetry.sh');
    expect(existsSync(slashHook)).toBe(true);

    // Verify executable mode (0o755). Mask to permission bits.
    const info = await stat(slashHook);
    expect(info.mode & 0o777).toBe(0o755);
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
