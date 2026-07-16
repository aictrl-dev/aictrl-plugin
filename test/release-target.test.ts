import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const repoRoot = resolve(import.meta.dirname, '..');
const resolver = resolve(repoRoot, 'scripts/resolve-release-target.mjs');
const rootVersion = JSON.parse(readFileSync(resolve(repoRoot, 'package.json'), 'utf8')).version;

describe('release target resolver', () => {
  it('routes the legacy installer release to the root package', () => {
    expect(resolveTag(`v${rootVersion}`)).toBe('package_spec=.\ndist_tag=latest\n');
  });

  it.each(['public-v0.1.0', 'v0.0.0', 'release-1'])('rejects an invalid or stale tag: %s', (tag) => {
    expect(() => resolveTag(tag)).toThrow();
  });
});

function resolveTag(tag: string): string {
  return execFileSync(process.execPath, [resolver, tag], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}
