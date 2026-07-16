import { existsSync, lstatSync, readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');

describe('public distribution ownership', () => {
  it.each([
    '.agents/plugins/marketplace.json',
    '.claude-plugin/marketplace.json',
    'claude/aictrl/skills',
    'opencode/skills',
    'plugins/aictrl/skills',
    'public-skills.lock.json',
  ])('does not recreate the retired generated path %s', (path) => {
    const target = resolve(root, path);
    const remainingFiles = !existsSync(target)
      ? []
      : lstatSync(target).isDirectory()
        ? readdirSync(target, { recursive: true, withFileTypes: true })
          .filter((entry) => !entry.isDirectory())
        : [target];
    expect(remainingFiles).toEqual([]);
  });

  it('points public users to the canonical skills repository', () => {
    const readme = readFileSync(resolve(root, 'README.md'), 'utf8');
    expect(readme).toContain('https://github.com/aictrl-dev/skills');
    expect(readme).toContain('npx skills add aictrl-dev/skills');
    expect(readme).toContain('https://aictrl.dev/mcp');
  });
});
