import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, readFile, stat } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { existsSync } from 'fs';
import { installOpenCode } from '../../src/writers/opencode.js';
import type { WritableSkill } from '../../src/writers/shared.js';

describe('installOpenCode', () => {
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

  it('writes skills to .opencode/skills/', async () => {
    await installOpenCode({
      projectDir: tempDir,
      skills,
      baseUrl: 'https://aictrl.dev',
    });

    const content = await readFile(
      join(tempDir, '.opencode', 'skills', 'code-review', 'SKILL.md'),
      'utf-8',
    );
    expect(content).toContain('Review code.');
  });

  it('writes telemetry hook with executable permissions', async () => {
    await installOpenCode({
      projectDir: tempDir,
      skills,
      baseUrl: 'https://aictrl.dev',
    });

    const hookPath = join(tempDir, '.opencode', 'hooks', 'skill-telemetry.sh');
    expect(existsSync(hookPath)).toBe(true);
    const hookStat = await stat(hookPath);
    expect(hookStat.mode & 0o111).toBeGreaterThan(0);
  });

  it('clears old skills on re-install', async () => {
    await installOpenCode({ projectDir: tempDir, skills, baseUrl: 'https://aictrl.dev' });
    expect(existsSync(join(tempDir, '.opencode', 'skills', 'code-review'))).toBe(true);

    const newSkills: WritableSkill[] = [
      { name: 'deploy', markdown: 'Deploy.', files: [] },
    ];
    await installOpenCode({ projectDir: tempDir, skills: newSkills, baseUrl: 'https://aictrl.dev' });

    expect(existsSync(join(tempDir, '.opencode', 'skills', 'deploy', 'SKILL.md'))).toBe(true);
    expect(existsSync(join(tempDir, '.opencode', 'skills', 'code-review'))).toBe(false);
  });
});
