import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, readFile, writeFile } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { ensureGitignore } from '../src/gitignore.js';

describe('ensureGitignore', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'aictrl-test-'));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true });
  });

  it('creates .gitignore if it does not exist', async () => {
    await ensureGitignore(tempDir, ['.cursor/mcp.json']);
    const content = await readFile(join(tempDir, '.gitignore'), 'utf-8');
    expect(content).toContain('.cursor/mcp.json');
  });

  it('appends missing entries to existing .gitignore', async () => {
    await writeFile(join(tempDir, '.gitignore'), 'node_modules/\n');
    await ensureGitignore(tempDir, ['.cursor/mcp.json']);
    const content = await readFile(join(tempDir, '.gitignore'), 'utf-8');
    expect(content).toContain('node_modules/');
    expect(content).toContain('.cursor/mcp.json');
  });

  it('does not duplicate existing entries', async () => {
    await writeFile(join(tempDir, '.gitignore'), '.cursor/mcp.json\n');
    await ensureGitignore(tempDir, ['.cursor/mcp.json']);
    const content = await readFile(join(tempDir, '.gitignore'), 'utf-8');
    const matches = content.match(/\.cursor\/mcp\.json/g);
    expect(matches).toHaveLength(1);
  });

  it('handles multiple entries', async () => {
    await ensureGitignore(tempDir, ['.cursor/mcp.json', '.env']);
    const content = await readFile(join(tempDir, '.gitignore'), 'utf-8');
    expect(content).toContain('.cursor/mcp.json');
    expect(content).toContain('.env');
  });
});
