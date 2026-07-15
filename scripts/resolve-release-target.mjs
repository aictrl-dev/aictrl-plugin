#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const tag = process.argv[2];

if (!tag?.startsWith('v')) {
  fail(`Unsupported release tag: ${tag || '(missing)'}`);
}

const packageMetadata = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const expectedTag = `v${packageMetadata.version}`;
if (tag !== expectedTag) {
  fail(`Release tag ${tag} does not match ${packageMetadata.name}@${packageMetadata.version}; expected ${expectedTag}`);
}

process.stdout.write('package_spec=.\n');
process.stdout.write('dist_tag=latest\n');

function fail(message) {
  console.error(message);
  process.exit(1);
}
