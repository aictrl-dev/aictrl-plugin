#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import {
  cpSync,
  existsSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const lock = JSON.parse(readFileSync(join(root, 'public-skills.lock.json'), 'utf8'));
const checkOnly = process.argv.includes('--check');
const sourceFlag = process.argv.indexOf('--source');
const requestedSource = sourceFlag === -1 ? null : process.argv[sourceFlag + 1];

if (sourceFlag !== -1 && !requestedSource) {
  throw new Error('--source requires a local checkout path');
}
if (lock.schemaVersion !== 1 || !/^[a-f0-9]{40}$/.test(lock.commit)) {
  throw new Error('public-skills.lock.json has an unsupported schema or commit');
}

let cleanup = null;
let sourceRoot;
if (requestedSource) {
  sourceRoot = resolve(requestedSource);
  const head = execFileSync('git', ['rev-parse', 'HEAD'], {
    cwd: sourceRoot,
    encoding: 'utf8',
  }).trim();
  if (head !== lock.commit) {
    throw new Error(`Local skills checkout is ${head}; lock requires ${lock.commit}`);
  }
} else {
  const temp = mkdtempSync(join(tmpdir(), 'aictrl-public-skills-'));
  cleanup = () => rmSync(temp, { recursive: true, force: true });
  execFileSync(
    'git',
    ['clone', '--quiet', '--filter=blob:none', '--no-checkout', lock.repository, temp],
    { stdio: 'inherit' },
  );
  execFileSync('git', ['checkout', '--quiet', lock.commit], { cwd: temp, stdio: 'inherit' });
  sourceRoot = temp;
}

try {
  verifySource(sourceRoot);
  if (checkOnly) {
    verifyTargets(sourceRoot);
    console.log(`Verified ${lock.skills.length} pinned skills in ${lock.targets.length} package targets.`);
  } else {
    writeTargets(sourceRoot);
    verifyTargets(sourceRoot);
    console.log(`Assembled ${lock.skills.length} pinned skills into ${lock.targets.length} package targets.`);
  }
} finally {
  cleanup?.();
}

function verifySource(source) {
  const checksumPath = join(source, lock.checksumsFile);
  const checksumBytes = readFileSync(checksumPath);
  if (sha256(checksumBytes) !== lock.checksumsSha256) {
    throw new Error(`${lock.checksumsFile} does not match the pinned digest`);
  }

  const entries = new Map(
    checksumBytes
      .toString('utf8')
      .trim()
      .split('\n')
      .map((line) => {
        const match = line.match(/^([a-f0-9]{64})  (.+)$/);
        if (!match) throw new Error(`Malformed checksum line: ${line}`);
        return [match[2], match[1]];
      }),
  );

  for (const skill of lock.skills) {
    const dir = join(source, lock.sourceDirectory, skill);
    if (!statSync(dir).isDirectory()) throw new Error(`Missing pinned skill: ${skill}`);
    const files = walkFiles(dir);
    if (!files.some((file) => file.endsWith('/SKILL.md') || file === 'SKILL.md')) {
      throw new Error(`${skill} has no SKILL.md`);
    }
    for (const file of files) {
      const sourceFile = join(dir, file);
      const checksumKey = join(lock.sourceDirectory, skill, file).replaceAll('\\', '/');
      const expected = entries.get(checksumKey);
      if (!expected) throw new Error(`Pinned checksum is missing ${checksumKey}`);
      const actual = sha256(readFileSync(sourceFile));
      if (actual !== expected) throw new Error(`Checksum mismatch for ${checksumKey}`);
    }
  }
}

function writeTargets(source) {
  for (const target of lock.targets) {
    const targetRoot = join(root, target);
    rmSync(targetRoot, { recursive: true, force: true });
    for (const skill of lock.skills) {
      cpSync(join(source, lock.sourceDirectory, skill), join(targetRoot, skill), {
        recursive: true,
      });
    }
  }
}

function verifyTargets(source) {
  for (const target of lock.targets) {
    const targetRoot = join(root, target);
    const actualSkills = existsSync(targetRoot)
      ? readdirSync(targetRoot, { withFileTypes: true })
          .filter((entry) => entry.isDirectory())
          .map((entry) => entry.name)
          .sort()
      : [];
    const expectedSkills = [...lock.skills].sort();
    if (JSON.stringify(actualSkills) !== JSON.stringify(expectedSkills)) {
      throw new Error(`${target} skill set differs from the lock`);
    }
    for (const skill of lock.skills) {
      compareTrees(
        join(source, lock.sourceDirectory, skill),
        join(targetRoot, skill),
        `${target}/${skill}`,
      );
    }
  }
}

function compareTrees(expectedRoot, actualRoot, label) {
  const expectedFiles = walkFiles(expectedRoot);
  const actualFiles = walkFiles(actualRoot);
  if (JSON.stringify(expectedFiles) !== JSON.stringify(actualFiles)) {
    throw new Error(`${label} file tree differs from the pinned source`);
  }
  for (const file of expectedFiles) {
    if (sha256(readFileSync(join(expectedRoot, file))) !== sha256(readFileSync(join(actualRoot, file)))) {
      throw new Error(`${label}/${file} differs from the pinned source`);
    }
  }
}

function walkFiles(directory) {
  const result = [];
  const visit = (current) => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const absolute = join(current, entry.name);
      if (entry.isSymbolicLink()) throw new Error(`Symlink is not allowed: ${absolute}`);
      if (entry.isDirectory()) visit(absolute);
      else if (entry.isFile()) result.push(relative(directory, absolute).replaceAll('\\', '/'));
    }
  };
  visit(directory);
  return result.sort();
}

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}
