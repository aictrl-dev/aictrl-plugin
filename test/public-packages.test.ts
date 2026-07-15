import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const repoRoot = resolve(import.meta.dirname, '..');
const expectedSkills = [
  'code-review',
  'create-bug',
  'create-issue',
  'create-workflow',
  'implement-code-change',
  'judge-review-findings',
  'reply-to-code-review',
  'spec-review',
];

describe('public vendor packages', () => {
  it('ships the exact pinned launch catalog in every target', () => {
    for (const target of ['claude/aictrl/skills', 'plugins/aictrl/skills', 'opencode/skills']) {
      expect(readdirSync(join(repoRoot, target)).sort()).toEqual(expectedSkills);
    }
  });

  it('ships a valid Codex manifest and explicit marketplace policy', () => {
    const plugin = json('plugins/aictrl/.codex-plugin/plugin.json');
    const marketplace = json('.agents/plugins/marketplace.json');
    expect(plugin.name).toBe('aictrl');
    expect(plugin.skills).toBe('./skills/');
    expect(plugin.mcpServers).toBe('./.mcp.json');
    expect(plugin.interface.defaultPrompt).toHaveLength(3);
    expect(marketplace.plugins[0]).toMatchObject({
      name: 'aictrl',
      policy: { installation: 'AVAILABLE', authentication: 'ON_USE' },
      category: 'Productivity',
    });
  });

  it('uses one canonical workflow MCP resource for every vendor package', () => {
    const lock = json('public-skills.lock.json');
    const codex = json('plugins/aictrl/.codex-plugin/plugin.json');
    const claude = json('claude/aictrl/.claude-plugin/plugin.json');
    const opencode = json('opencode/package.json');
    const manifest = json('opencode/skills-manifest.json');

    expect(json('plugins/aictrl/.mcp.json').mcpServers.aictrl.url).toBe(
      publicMcpUrl(),
    );
    expect(json('claude/aictrl/.mcp.json').mcpServers.aictrl.url).toBe(
      publicMcpUrl(),
    );
    expect(manifest).toEqual({ skillsVersion: lock.skillsVersion, skills: lock.skills });
    expect(opencode.version).toBe(codex.version);
    expect(opencode.version).toBe(claude.version);
  });

  it('installs, repeats, and uninstalls OpenCode without clobbering unrelated config', () => {
    const root = mkdtempSync(join(tmpdir(), 'aictrl-opencode-test-'));
    const configRoot = join(root, 'opencode');
    const configFile = join(configRoot, 'opencode.json');
    mkdirSync(configRoot, { recursive: true });
    writeFileSync(
      configFile,
      JSON.stringify({ mcp: { existing: { type: 'remote', url: 'https://example.com/mcp' } }, theme: 'system' }),
    );
    const env = { ...process.env, XDG_CONFIG_HOME: root };
    const installer = join(repoRoot, 'opencode/bin/install.js');
    const expectedMcpUrl = publicMcpUrl();

    execFileSync(process.execPath, [installer], { env });
    execFileSync(process.execPath, [installer], { env });

    expect(readdirSync(join(configRoot, 'skills')).sort()).toEqual(expectedSkills);
    expect(jsonAt(configFile)).toMatchObject({
      theme: 'system',
      mcp: {
        existing: { type: 'remote', url: 'https://example.com/mcp' },
        aictrl: { type: 'remote', url: expectedMcpUrl, enabled: true },
      },
    });

    execFileSync(process.execPath, [installer, '--uninstall'], { env });
    expect(jsonAt(configFile)).toMatchObject({
      theme: 'system',
      mcp: { existing: { type: 'remote', url: 'https://example.com/mcp' } },
    });
  });

  it('upgrades AICtrl-managed OpenCode state without removing unrelated skills', () => {
    const root = mkdtempSync(join(tmpdir(), 'aictrl-opencode-upgrade-'));
    const configRoot = join(root, 'opencode');
    const configFile = join(configRoot, 'opencode.json');
    const skillsRoot = join(configRoot, 'skills');
    const managedSkill = join(skillsRoot, 'implement-code-change');
    const unrelatedSkill = join(skillsRoot, 'team-custom');
    mkdirSync(managedSkill, { recursive: true });
    mkdirSync(unrelatedSkill, { recursive: true });
    writeFileSync(join(managedSkill, 'SKILL.md'), 'stale managed skill\n');
    writeFileSync(join(unrelatedSkill, 'SKILL.md'), 'unrelated team skill\n');
    writeFileSync(
      configFile,
      JSON.stringify({
        theme: 'system',
        mcp: {
          existing: { type: 'remote', url: 'https://example.com/mcp' },
          aictrl: {
            type: 'remote',
            url: 'https://aictrl.dev/mcp/workflows/opencode-ecosystem/0.1.0-beta.1/implement-code-change/1.0.0',
            enabled: true,
          },
        },
      }),
    );

    execFileSync(process.execPath, [join(repoRoot, 'opencode/bin/install.js')], {
      env: { ...process.env, XDG_CONFIG_HOME: root },
    });

    expect(jsonAt(configFile)).toMatchObject({
      theme: 'system',
      mcp: {
        existing: { type: 'remote', url: 'https://example.com/mcp' },
        aictrl: {
          type: 'remote',
          url: publicMcpUrl(),
          enabled: true,
        },
      },
    });
    expect(readFileSync(join(managedSkill, 'SKILL.md'), 'utf8')).toBe(
      readFileSync(join(repoRoot, 'opencode/skills/implement-code-change/SKILL.md'), 'utf8'),
    );
    expect(readFileSync(join(unrelatedSkill, 'SKILL.md'), 'utf8')).toBe('unrelated team skill\n');
  });

  it('fails closed instead of overwriting malformed OpenCode config', () => {
    const root = mkdtempSync(join(tmpdir(), 'aictrl-opencode-invalid-'));
    const configRoot = join(root, 'opencode');
    const configFile = join(configRoot, 'opencode.json');
    mkdirSync(configRoot, { recursive: true });
    writeFileSync(configFile, '{ invalid json');

    expect(() =>
      execFileSync(process.execPath, [join(repoRoot, 'opencode/bin/install.js')], {
        env: { ...process.env, XDG_CONFIG_HOME: root },
        stdio: 'pipe',
      }),
    ).toThrow();
    expect(readFileSync(configFile, 'utf8')).toBe('{ invalid json');
  });
});

function json(path: string): any {
  return jsonAt(join(repoRoot, path));
}

function jsonAt(path: string): any {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function publicMcpUrl(): string {
  return 'https://aictrl.dev/mcp';
}
