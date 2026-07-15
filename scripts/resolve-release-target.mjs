#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const tag = process.argv[2];

const targets = [
  {
    prefix: 'public-v',
    packageSpec: './opencode',
    packageJson: 'opencode/package.json',
    distTag: 'beta',
  },
  {
    prefix: 'v',
    packageSpec: '.',
    packageJson: 'package.json',
    distTag: 'latest',
  },
];

const target = targets.find((candidate) => tag?.startsWith(candidate.prefix));
if (!target) {
  fail(`Unsupported release tag: ${tag || '(missing)'}`);
}

const packageMetadata = JSON.parse(readFileSync(join(root, target.packageJson), 'utf8'));
const expectedTag = `${target.prefix}${packageMetadata.version}`;
if (tag !== expectedTag) {
  fail(`Release tag ${tag} does not match ${packageMetadata.name}@${packageMetadata.version}; expected ${expectedTag}`);
}

process.stdout.write(`package_spec=${target.packageSpec}\n`);
process.stdout.write(`dist_tag=${target.distTag}\n`);

function fail(message) {
  console.error(message);
  process.exit(1);
}
