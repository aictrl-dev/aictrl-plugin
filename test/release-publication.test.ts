import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { vi } from 'vitest';

import { inspectReleasePublication } from '../scripts/verify-release-publication.mjs';

const packageSpec = './opencode';
const packageMetadata = JSON.parse(
  readFileSync(resolve(import.meta.dirname, '..', 'opencode', 'package.json'), 'utf8'),
) as { name: string; version: string };
const packageIdentity = { name: packageMetadata.name, version: packageMetadata.version };

describe('release publication verifier', () => {
  it('allows publication when the exact version is absent', async () => {
    const pack = vi.fn();
    const fetchImpl = vi.fn().mockResolvedValue(new Response(null, { status: 404 }));
    const result = await inspectReleasePublication(packageSpec, {
      fetchImpl,
      pack,
      registry: 'https://registry.example.test',
    });

    expect(result).toEqual({ published: false, ...packageIdentity });
    expect(fetchImpl).toHaveBeenCalledWith(
      `https://registry.example.test/%40aictrl%2Fopencode/${packageIdentity.version}`,
      { headers: { accept: 'application/json' } },
    );
    expect(pack).not.toHaveBeenCalled();
  });

  it('skips publication only when the published and local integrities match', async () => {
    const result = await inspectReleasePublication(packageSpec, {
      fetchImpl: vi.fn().mockResolvedValue(
        Response.json({ dist: { integrity: 'sha512-matching' } }),
      ),
      pack: vi.fn().mockResolvedValue({ ...packageIdentity, integrity: 'sha512-matching' }),
      registry: 'https://registry.example.test/',
    });

    expect(result).toEqual({ published: true, ...packageIdentity });
  });

  it('rejects an existing version with different package contents', async () => {
    await expect(
      inspectReleasePublication(packageSpec, {
        fetchImpl: vi.fn().mockResolvedValue(
          Response.json({ dist: { integrity: 'sha512-published' } }),
        ),
        pack: vi.fn().mockResolvedValue({ ...packageIdentity, integrity: 'sha512-local' }),
        registry: 'https://registry.example.test',
      }),
    ).rejects.toThrow('does not match the local release package');
  });

  it('fails closed on registry errors', async () => {
    await expect(
      inspectReleasePublication(packageSpec, {
        fetchImpl: vi.fn().mockResolvedValue(new Response(null, { status: 503 })),
        pack: vi.fn(),
        registry: 'https://registry.example.test',
      }),
    ).rejects.toThrow('npm registry returned HTTP 503');
  });
});
