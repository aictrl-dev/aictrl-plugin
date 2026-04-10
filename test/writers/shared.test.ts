import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, readFile } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { existsSync } from 'fs';
import { writeSkill, clearSkillsDir } from '../../src/writers/shared.js';

describe('writeSkill', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'aictrl-test-'));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true });
  });

  it('writes SKILL.md to the correct directory', async () => {
    await writeSkill(tempDir, {
      name: 'code-review',
      markdown: '---\nname: code-review\n---\n\nReview code.',
      files: [],
    });

    const content = await readFile(join(tempDir, 'code-review', 'SKILL.md'), 'utf-8');
    expect(content).toContain('Review code.');
  });

  it('writes supporting files preserving directory structure', async () => {
    await writeSkill(tempDir, {
      name: 'tdd',
      markdown: '---\nname: tdd\n---\n\nTDD guide.',
      files: [
        { path: 'references/checklist.md', content: '# Checklist' },
        { path: 'scripts/validate.sh', content: '#!/bin/bash\necho ok' },
      ],
    });

    const checklist = await readFile(join(tempDir, 'tdd', 'references', 'checklist.md'), 'utf-8');
    expect(checklist).toBe('# Checklist');

    const script = await readFile(join(tempDir, 'tdd', 'scripts', 'validate.sh'), 'utf-8');
    expect(script).toContain('echo ok');
  });
});

describe('clearSkillsDir', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'aictrl-test-'));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true });
  });

  it('removes all contents of the skills directory', async () => {
    await writeSkill(tempDir, {
      name: 'old-skill',
      markdown: 'old content',
      files: [],
    });
    expect(existsSync(join(tempDir, 'old-skill'))).toBe(true);

    await clearSkillsDir(tempDir);
    expect(existsSync(join(tempDir, 'old-skill'))).toBe(false);
    expect(existsSync(tempDir)).toBe(true);
  });

  it('does nothing if directory does not exist', async () => {
    await clearSkillsDir(join(tempDir, 'nonexistent'));
    // Should not throw
  });
});
