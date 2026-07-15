import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const fixtureRoot = join(root, 'submission/codex/fixture-template');
const repositoryRoot = join(fixtureRoot, 'repository');

describe('Codex reviewer fixture template', () => {
  it('is a dependency-free private package with a passing baseline test', () => {
    const packageJson = JSON.parse(readFileSync(join(repositoryRoot, 'package.json'), 'utf8'));

    expect(packageJson).toMatchObject({
      name: 'aictrl-plugin-reviewer-fixture',
      private: true,
      type: 'module',
      scripts: { test: 'node --test' },
    });
    expect(packageJson.dependencies).toBeUndefined();
    expect(packageJson.devDependencies).toBeUndefined();

    const output = execFileSync(process.execPath, ['--test'], {
      cwd: repositoryRoot,
      encoding: 'utf8',
    });
    expect(output).toContain('# pass 2');
    expect(output).toContain('# fail 0');
  });

  it('keeps the requested change absent from baseline and fully specified', () => {
    const source = readFileSync(join(repositoryRoot, 'src/labels.mjs'), 'utf8');
    const issue = readFileSync(join(fixtureRoot, 'issue.md'), 'utf8');

    expect(source).not.toContain('normalizeLabel');
    expect(issue).toContain('Export `normalizeLabel(label)`');
    expect(issue).toContain('Throw `TypeError`');
    expect(issue).toContain('Keep the project dependency-free');
    expect(issue).toContain('Do not merge or deploy');
  });
});
