import { describe, it, expect } from 'vitest';
import { generateClaudeSlashCommandHook } from '../../src/hooks/claude-slash.sh.js';

describe('generateClaudeSlashCommandHook', () => {
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
    expect(script).toContain('-path "*/skills/$BARE_NAME/SKILL.md"');
    expect(script).toContain('-print -quit');
  });

  it('exits 0 when the command does not resolve locally', () => {
    expect(script).toContain('[ "$FOUND" -eq 0 ] && exit 0');
  });

  it('embeds the telemetry helper and posts with claude-code-slash source', () => {
    expect(script).toContain('send_telemetry()');
    expect(script).toContain('send_telemetry "$QUALIFIED_NAME" "claude-code-slash"');
  });
});
