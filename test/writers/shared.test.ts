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

describe('writeSkill with qualified names', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'aictrl-test-'));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true });
  });

  it('accepts a qualified id and writes the folder using the bare name', async () => {
    await writeSkill(tempDir, {
      name: 'aictrl-dev__aictrl__kg-classify',
      markdown: '---\nname: kg-classify\n---\n\nKG classify.',
      files: [],
    });

    const content = await readFile(join(tempDir, 'kg-classify', 'SKILL.md'), 'utf-8');
    expect(content).toContain('KG classify.');
    // qualified-named folder must NOT be created
    const { existsSync } = await import('fs');
    expect(existsSync(join(tempDir, 'aictrl-dev__aictrl__kg-classify'))).toBe(false);
  });

  it('rejects a malformed qualified name (one __ separator)', async () => {
    await expect(
      writeSkill(tempDir, {
        name: 'aictrl-dev__kg-classify',
        markdown: '',
        files: [],
      }),
    ).rejects.toThrow(/malformed/i);
  });

  it('bare names still work unchanged', async () => {
    await writeSkill(tempDir, {
      name: 'plain-skill',
      markdown: '# plain',
      files: [],
    });
    const content = await readFile(join(tempDir, 'plain-skill', 'SKILL.md'), 'utf-8');
    expect(content).toBe('# plain');
  });

  it('writes supporting files under the bare-name folder for a qualified id', async () => {
    await writeSkill(tempDir, {
      name: 'aictrl-dev__aictrl__kg-classify',
      markdown: '# kg',
      files: [{ path: 'scripts/run.sh', content: '#!/bin/bash' }],
    });

    const script = await readFile(join(tempDir, 'kg-classify', 'scripts', 'run.sh'), 'utf-8');
    expect(script).toBe('#!/bin/bash');
  });

  it('rejects a qualified id whose bare name fails SKILL_NAME_REGEX', async () => {
    await expect(
      writeSkill(tempDir, {
        name: 'aictrl-dev__aictrl__UPPERCASE',
        markdown: '',
        files: [],
      }),
    ).rejects.toThrow(/invalid/i);
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
