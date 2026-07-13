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

    execFileSync(process.execPath, [installer], { env });
    execFileSync(process.execPath, [installer], { env });

    expect(readdirSync(join(configRoot, 'skills')).sort()).toEqual(expectedSkills);
    expect(jsonAt(configFile)).toMatchObject({
      theme: 'system',
      mcp: {
        existing: { type: 'remote', url: 'https://example.com/mcp' },
        aictrl: { type: 'remote', url: 'https://aictrl.dev/mcp/workflows', enabled: true },
      },
    });

    execFileSync(process.execPath, [installer, '--uninstall'], { env });
    expect(jsonAt(configFile)).toMatchObject({
      theme: 'system',
      mcp: { existing: { type: 'remote', url: 'https://example.com/mcp' } },
    });
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
