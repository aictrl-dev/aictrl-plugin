#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import {
  cpSync,
  existsSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const codexHome = mkdtempSync(join(tmpdir(), 'aictrl-codex-public-'));
const marketplaceRoot = join(codexHome, 'marketplace');
const marketplacePluginRoot = join(marketplaceRoot, 'plugins/aictrl');
const codex = process.env.CODEX_BIN || 'codex';
const env = { ...process.env, CODEX_HOME: codexHome };
const pluginId = 'aictrl@aictrl-public';
const publicSkillsLock = json(join(root, 'public-skills.lock.json'));
const expectedSkills = [
  'code-review',
  'create-bug',
  'create-issue',
  'create-workflow',
  'implement-code-change',
  'judge-review-findings',
  'reply-to-code-review',
  'spec-review',
];

try {
  cpSync(join(root, '.agents'), join(marketplaceRoot, '.agents'), { recursive: true });
  cpSync(join(root, 'plugins'), join(marketplaceRoot, 'plugins'), { recursive: true });

  run(['plugin', 'marketplace', 'add', marketplaceRoot]);
  assertIncludes(run(['plugin', 'marketplace', 'list']), 'aictrl-public', 'marketplace list');

  const sourceManifest = json(join(marketplacePluginRoot, '.codex-plugin/plugin.json'));
  run(['plugin', 'add', pluginId]);
  assertInstalled(sourceManifest.version);

  // Re-installing the same package must be idempotent.
  run(['plugin', 'add', pluginId]);
  assertInstalled(sourceManifest.version);

  // A changed marketplace version must replace the installed cache entry.
  const upgradeVersion = `${sourceManifest.version.split('-')[0]}-smoke.1`;
  writeFileSync(
    join(marketplacePluginRoot, '.codex-plugin/plugin.json'),
    `${JSON.stringify({ ...sourceManifest, version: upgradeVersion }, null, 2)}\n`,
  );
  const upgradedMcp = json(join(marketplacePluginRoot, '.mcp.json'));
  upgradedMcp.mcpServers.aictrl.url = publicMcpUrl(upgradeVersion);
  writeFileSync(
    join(marketplacePluginRoot, '.mcp.json'),
    `${JSON.stringify(upgradedMcp, null, 2)}\n`,
  );
  run(['plugin', 'add', pluginId]);
  assertInstalled(upgradeVersion);

  run(['plugin', 'remove', pluginId]);
  assertIncludes(run(['plugin', 'list']), 'not installed', 'plugin list after removal');

  const config = readFileSync(join(codexHome, 'config.toml'), 'utf8');
  if (config.includes(`[plugins."${pluginId}"]`)) {
    throw new Error('Codex removal left the AICtrl plugin enabled in config.toml');
  }
  assertIncludes(config, '[marketplaces.aictrl-public]', 'config after removal');

  console.log('Codex public marketplace lifecycle smoke passed.');
} finally {
  rmSync(codexHome, { recursive: true, force: true });
}

function assertInstalled(expectedVersion) {
  const listing = run(['plugin', 'list']);
  assertIncludes(listing, pluginId, 'installed plugin list');
  assertIncludes(listing, 'installed, enabled', 'installed plugin status');

  const installedRoot = join(
    codexHome,
    'plugins/cache/aictrl-public/aictrl',
    expectedVersion,
  );
  const installedManifest = json(join(installedRoot, '.codex-plugin/plugin.json'));
  if (installedManifest.name !== 'aictrl' || installedManifest.version !== expectedVersion) {
    throw new Error('Installed Codex manifest does not match the source package');
  }

  const installedMcp = json(join(installedRoot, '.mcp.json'));
  if (installedMcp.mcpServers?.aictrl?.url !== publicMcpUrl(expectedVersion)) {
    throw new Error('Installed Codex plugin does not target its versioned workflow MCP resource');
  }

  const skillsRoot = join(installedRoot, 'skills');
  const installedSkills = readdirSync(skillsRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
  if (JSON.stringify(installedSkills) !== JSON.stringify(expectedSkills)) {
    throw new Error(`Installed Codex skills differ: ${installedSkills.join(', ')}`);
  }
  for (const skill of expectedSkills) {
    if (!existsSync(join(skillsRoot, skill, 'SKILL.md'))) {
      throw new Error(`Installed Codex skill is missing SKILL.md: ${skill}`);
    }
  }
}

function run(args) {
  try {
    return execFileSync(codex, args, {
      cwd: root,
      env,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch (error) {
    const stderr = error?.stderr?.toString?.() || '';
    throw new Error(`codex ${args.join(' ')} failed${stderr ? `: ${stderr.trim()}` : ''}`);
  }
}

function json(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function assertIncludes(value, expected, context) {
  if (!value.includes(expected)) {
    throw new Error(`${context} did not include ${JSON.stringify(expected)}`);
  }
}

function publicMcpUrl(pluginVersion) {
  return `https://aictrl.dev/mcp/workflows/codex-plugin-directory/${pluginVersion}/implement-code-change/${publicSkillsLock.skillsVersion}`;
}
