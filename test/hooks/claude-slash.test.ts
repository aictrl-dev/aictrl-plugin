import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { generateClaudeSlashCommandHook } from '../../src/hooks/claude-slash.sh.js';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync, chmodSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

describe('generateClaudeSlashCommandHook (static assertions)', () => {
  const script = generateClaudeSlashCommandHook('https://aictrl.dev');

  it('starts with bash shebang and strict-mode flags', () => {
    expect(script.startsWith('#!/bin/bash\n')).toBe(true);
    expect(script).toContain('set -eo pipefail');
  });

  it('embeds the credential resolver snippet', () => {
    expect(script).toContain('AICTRL_PROJECT_CONFIG=".aictrl.json"');
    expect(script).toContain('PROJECT_ROOT=$(find_project_root) || exit 0');
    expect(script).toContain('AICTRL_BASE_URL="https://aictrl.dev"');
  });

  it('reads stdin and parses .prompt via jq', () => {
    expect(script).toContain('INPUT=$(cat)');
    expect(script).toContain("jq -r '.prompt // empty'");
  });

  it('extracts the leading slash command from the first line only', () => {
    expect(script).toContain('head -n1');
    expect(script).toContain("grep -oE '^/[a-z0-9][a-z0-9:_-]*'");
  });

  it('strips the leading slash and computes a bare name', () => {
    expect(script).toContain('COMMAND="${COMMAND#/}"');
    expect(script).toContain('BARE_NAME="${COMMAND##*:}"');
    expect(script).toContain('QUALIFIED_NAME="$COMMAND"');
  });

  it('validates the skill/command exists in user, project, and command paths', () => {
    expect(script).toContain('"$HOME/.claude/skills/$BARE_NAME/SKILL.md"');
    expect(script).toContain('"$PROJECT_ROOT/.claude/skills/$BARE_NAME/SKILL.md"');
    expect(script).toContain('"$PROJECT_ROOT/.claude/commands/$BARE_NAME.md"');
  });

  it('uses depth-bounded find for plugin-cache lookup', () => {
    expect(script).toContain('find "$HOME/.claude/plugins/cache" -maxdepth 6');
    expect(script).toContain('-print -quit');
  });

  it('plugin-cache find covers BOTH skills/SKILL.md and commands/*.md layouts', () => {
    expect(script).toContain('-path "*/skills/$BARE_NAME/SKILL.md"');
    expect(script).toContain('-path "*/commands/$BARE_NAME.md"');
    // Ensure the two patterns are combined with -o (logical OR) inside a group
    expect(script).toMatch(
      /\\\(\s*-path "\*\/skills\/\$BARE_NAME\/SKILL\.md"\s*-o\s*-path "\*\/commands\/\$BARE_NAME\.md"\s*\\\)/,
    );
  });

  it('exits 0 when the command does not resolve locally', () => {
    expect(script).toContain('[ "$FOUND" -eq 0 ] && exit 0');
  });

  it('embeds the telemetry helper and posts with claude-code-slash source', () => {
    expect(script).toContain('send_telemetry()');
    expect(script).toContain('send_telemetry "$QUALIFIED_NAME" "claude-code-slash"');
  });
});

/**
 * Runtime tests: write the generated bash to a temp file, execute it with a
 * synthetic JSON prompt on stdin, and assert whether telemetry was sent by
 * inspecting a sentinel file written by a stub `curl` injected via PATH.
 */
describe('generateClaudeSlashCommandHook (runtime behavior)', () => {
  const script = generateClaudeSlashCommandHook('https://aictrl.dev');
  let root: string;
  let scriptPath: string;
  let stubBin: string;
  let sentinel: string;

  beforeAll(() => {
    root = mkdtempSync(join(tmpdir(), 'aictrl-slash-test-'));
    scriptPath = join(root, 'hook.sh');
    writeFileSync(scriptPath, script, { mode: 0o755 });
    chmodSync(scriptPath, 0o755);

    // Stub curl: any invocation appends a marker line to a sentinel file.
    stubBin = join(root, 'stubbin');
    mkdirSync(stubBin, { recursive: true });
    sentinel = join(root, 'curl-calls.log');
    const stubCurl = `#!/bin/bash\necho "called: $*" >> "${sentinel}"\nexit 0\n`;
    writeFileSync(join(stubBin, 'curl'), stubCurl, { mode: 0o755 });
    chmodSync(join(stubBin, 'curl'), 0o755);
  });

  afterAll(() => {
    rmSync(root, { recursive: true, force: true });
  });

  /**
   * Run the hook with a fresh fake HOME/PROJECT.
   *
   * @param prompt The .prompt JSON string the hook will see on stdin.
   * @param opts.skills        Names to create as ~/.claude/skills/<name>/SKILL.md
   * @param opts.pluginSkills  Names to create as plugin-cache .../skills/<n>/SKILL.md
   * @param opts.pluginCommands Names to create as plugin-cache .../commands/<n>.md
   * @param opts.withCreds     If false, omit credentials so the script exits 0
   *                           before telemetry.
   */
  function runHook(
    prompt: string,
    opts: {
      skills?: string[];
      pluginSkills?: string[];
      pluginCommands?: string[];
      withCreds?: boolean;
    } = {},
  ): { code: number; fired: boolean; stderr: string } {
    const { skills = [], pluginSkills = [], pluginCommands = [], withCreds = true } = opts;
    const caseDir = mkdtempSync(join(root, 'case-'));
    const home = join(caseDir, 'home');
    const project = join(caseDir, 'project');
    mkdirSync(home, { recursive: true });
    mkdirSync(project, { recursive: true });

    // Project marker so find_project_root() succeeds.
    writeFileSync(join(project, '.aictrl.json'), JSON.stringify({ orgSlug: 'acme' }));

    if (withCreds) {
      const credDir = join(home, '.aictrl');
      mkdirSync(credDir, { recursive: true });
      writeFileSync(
        join(credDir, 'credentials.json'),
        JSON.stringify({ orgs: { acme: { apiKey: 'test-key-123' } } }),
      );
    }

    for (const name of skills) {
      mkdirSync(join(home, '.claude', 'skills', name), { recursive: true });
      writeFileSync(join(home, '.claude', 'skills', name, 'SKILL.md'), '# skill\n');
    }
    for (const name of pluginSkills) {
      const p = join(home, '.claude', 'plugins', 'cache', 'mp', 'plug', '1.0.0', 'skills', name);
      mkdirSync(p, { recursive: true });
      writeFileSync(join(p, 'SKILL.md'), '# plugin skill\n');
    }
    for (const name of pluginCommands) {
      const p = join(home, '.claude', 'plugins', 'cache', 'mp', 'plug', '1.0.0', 'commands');
      mkdirSync(p, { recursive: true });
      writeFileSync(join(p, `${name}.md`), '# plugin command\n');
    }

    // Reset sentinel for this case.
    writeFileSync(sentinel, '');

    const res = spawnSync('bash', [scriptPath], {
      input: JSON.stringify({ prompt }),
      env: {
        // Inject stub curl ahead of system curl.
        PATH: `${stubBin}:${process.env.PATH ?? ''}`,
        HOME: home,
        PWD: project,
      },
      cwd: project,
      encoding: 'utf-8',
      timeout: 10_000,
    });

    const fired = existsSync(sentinel) && readFileSync(sentinel, 'utf-8').includes('called:');
    return { code: res.status ?? -1, fired, stderr: res.stderr };
  }

  it('case 1: args after a valid command name still fire telemetry', () => {
    const r = runHook('/foo do this and that', { skills: ['foo'] });
    expect(r.code).toBe(0);
    expect(r.fired).toBe(true);
  });

  it('case 2: slash not at start of line does NOT fire', () => {
    const r = runHook('please run /foo', { skills: ['foo'] });
    expect(r.code).toBe(0);
    expect(r.fired).toBe(false);
  });

  it('case 3: multi-line prompt with slash on line 2 does NOT fire (head -n1)', () => {
    const r = runHook('hi there\n/foo', { skills: ['foo'] });
    expect(r.code).toBe(0);
    expect(r.fired).toBe(false);
  });

  it('case 4: path-like input "/usr/local/bin" extracts "usr"; no skill on disk -> no fire', () => {
    // Explicitly create no `usr` skill anywhere.
    const r = runHook('/usr/local/bin', { skills: [] });
    expect(r.code).toBe(0);
    expect(r.fired).toBe(false);
  });

  it('case 5: dotted suffix "/foo.bar baz" extracts "foo" cleanly', () => {
    const r = runHook('/foo.bar baz', { skills: ['foo'] });
    expect(r.code).toBe(0);
    expect(r.fired).toBe(true);
  });

  it('case 6: built-in command shadows /help /clear /config /model do not fire when no SKILL.md present', () => {
    for (const name of ['help', 'clear', 'config', 'model']) {
      const r = runHook(`/${name}`, { skills: [] });
      expect(r.code, `${name} exit code`).toBe(0);
      expect(r.fired, `${name} should not fire telemetry`).toBe(false);
    }
  });

  it('case 7: bare slash "/" does not match', () => {
    const r = runHook('/', { skills: [] });
    expect(r.code).toBe(0);
    expect(r.fired).toBe(false);
  });

  it('case 8: backtick-quoted "`/foo`" does not match (first char is backtick)', () => {
    const r = runHook('`/foo`', { skills: ['foo'] });
    expect(r.code).toBe(0);
    expect(r.fired).toBe(false);
  });

  it('case 9: plugin-namespaced "/superpowers:brainstorming" looks up bare name and fires with full qualified name', () => {
    const r = runHook('/superpowers:brainstorming', {
      pluginSkills: ['brainstorming'],
    });
    expect(r.code).toBe(0);
    expect(r.fired).toBe(true);
    // Confirm the qualified name (with colon) made it into the curl payload.
    const log = readFileSync(sentinel, 'utf-8');
    expect(log).toContain('called:');
    // The skillName is sent in the JSON body via -d "$PAYLOAD"; spaces in the
    // JSON show up in the stub log because we echoed all args.
    expect(log).toContain('superpowers:brainstorming');
  });

  it('plugin-shipped commands (commands/<name>.md) are now found and fire telemetry', () => {
    const r = runHook('/gsd:debug', {
      pluginCommands: ['debug'],
    });
    expect(r.code).toBe(0);
    expect(r.fired).toBe(true);
    const log = readFileSync(sentinel, 'utf-8');
    expect(log).toContain('gsd:debug');
  });
});
