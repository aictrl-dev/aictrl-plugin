import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, readFile, writeFile as fsWriteFile, mkdir, stat } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { existsSync } from 'fs';
import { installCursor } from '../../src/writers/cursor.js';
import type { WritableSkill } from '../../src/writers/shared.js';

describe('installCursor', () => {
  let tempDir: string;

  const skills: WritableSkill[] = [
    {
      name: 'code-review',
      markdown: '---\nname: code-review\n---\n\nReview code.',
      files: [],
    },
  ];

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'aictrl-test-'));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true });
  });

  it('writes skills to .cursor/skills/', async () => {
    await installCursor({
      projectDir: tempDir,
      orgSlug: 'talentrix',
      skills,
      apiKey: 'sk_live_xxx',
      baseUrl: 'https://aictrl.dev',
    });

    const content = await readFile(
      join(tempDir, '.cursor', 'skills', 'code-review', 'SKILL.md'),
      'utf-8',
    );
    expect(content).toContain('Review code.');
  });

  it('writes MCP config to .cursor/mcp.json', async () => {
    await installCursor({
      projectDir: tempDir,
      orgSlug: 'talentrix',
      skills,
      apiKey: 'sk_live_xxx',
      baseUrl: 'https://aictrl.dev',
    });

    const mcpJson = JSON.parse(
      await readFile(join(tempDir, '.cursor', 'mcp.json'), 'utf-8'),
    );
    expect(mcpJson.mcpServers['aictrl-talentrix'].url).toBe('https://aictrl.dev/talentrix/mcp');
    expect(mcpJson.mcpServers['aictrl-talentrix'].headers.Authorization).toBe('Bearer sk_live_xxx');
  });

  it('preserves existing MCP servers when merging', async () => {
    await mkdir(join(tempDir, '.cursor'), { recursive: true });
    await fsWriteFile(
      join(tempDir, '.cursor', 'mcp.json'),
      JSON.stringify({ mcpServers: { 'other-server': { url: 'http://other' } } }),
    );

    await installCursor({
      projectDir: tempDir,
      orgSlug: 'talentrix',
      skills,
      apiKey: 'sk_live_xxx',
      baseUrl: 'https://aictrl.dev',
    });

    const mcpJson = JSON.parse(
      await readFile(join(tempDir, '.cursor', 'mcp.json'), 'utf-8'),
    );
    expect(mcpJson.mcpServers['other-server'].url).toBe('http://other');
    expect(mcpJson.mcpServers['aictrl-talentrix']).toBeDefined();
  });

  it('writes telemetry hook with executable permissions', async () => {
    await installCursor({
      projectDir: tempDir,
      orgSlug: 'talentrix',
      skills,
      apiKey: 'sk_live_xxx',
      baseUrl: 'https://aictrl.dev',
    });

    const hookPath = join(tempDir, '.cursor', 'hooks', 'skill-telemetry.sh');
    expect(existsSync(hookPath)).toBe(true);
    const hookStat = await stat(hookPath);
    expect(hookStat.mode & 0o111).toBeGreaterThan(0);
  });
});
