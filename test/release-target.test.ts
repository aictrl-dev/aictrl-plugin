import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const repoRoot = resolve(import.meta.dirname, '..');
const resolver = resolve(repoRoot, 'scripts/resolve-release-target.mjs');
const rootVersion = JSON.parse(readFileSync(resolve(repoRoot, 'package.json'), 'utf8')).version;
const publicVersion = JSON.parse(readFileSync(resolve(repoRoot, 'opencode/package.json'), 'utf8')).version;

describe('release target resolver', () => {
  it('routes public beta releases to the OpenCode package', () => {
    expect(resolveTag(`public-v${publicVersion}`)).toBe('package_spec=./opencode\ndist_tag=beta\n');
  });

  it('routes root package releases independently', () => {
    expect(resolveTag(`v${rootVersion}`)).toBe('package_spec=.\ndist_tag=latest\n');
  });

  it.each(['public-v0.0.0', 'v0.0.0', 'release-1'])('rejects an invalid or stale tag: %s', (tag) => {
    expect(() => resolveTag(tag)).toThrow();
  });
});

function resolveTag(tag: string): string {
  return execFileSync(process.execPath, [resolver, tag], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}
