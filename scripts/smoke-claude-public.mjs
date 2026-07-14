#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const configDir = mkdtempSync(join(tmpdir(), 'aictrl-claude-public-'));
const workDir = mkdtempSync(join(tmpdir(), 'aictrl-claude-work-'));
const claude = process.env.CLAUDE_BIN || 'claude';
const source = process.env.AICTRL_CLAUDE_MARKETPLACE_SOURCE || 'aictrl-dev/aictrl-plugin';
const env = { ...process.env, CLAUDE_CONFIG_DIR: configDir };
const marketplaceName = 'aictrl-public';
const pluginId = `aictrl@${marketplaceName}`;
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
  run(['plugin', 'marketplace', 'add', source]);
  const marketplaces = jsonOutput(['plugin', 'marketplace', 'list', '--json']);
  const marketplace = marketplaces.find((entry) => entry.name === marketplaceName);
  if (!marketplace || marketplace.source !== 'github') {
    throw new Error(`Claude did not register ${marketplaceName} as a GitHub marketplace`);
  }

  run(['plugin', 'install', pluginId, '--scope', 'user']);
  assertInstalled();

  // Re-installing the same public package must leave one enabled installation.
  run(['plugin', 'install', pluginId, '--scope', 'user']);
  assertInstalled();

  run(['plugin', 'uninstall', pluginId, '--scope', 'user', '--yes']);
  const afterUninstall = jsonOutput(['plugin', 'list', '--json']);
  if (afterUninstall.some((plugin) => plugin.id === pluginId)) {
    throw new Error('Claude uninstall left the AICtrl plugin installed');
  }

  run(['plugin', 'marketplace', 'remove', marketplaceName]);
  const afterRemoval = jsonOutput(['plugin', 'marketplace', 'list', '--json']);
  if (afterRemoval.some((entry) => entry.name === marketplaceName)) {
    throw new Error('Claude marketplace removal left aictrl-public configured');
  }

  console.log('Claude public marketplace lifecycle smoke passed.');
} finally {
  rmSync(configDir, { recursive: true, force: true });
  rmSync(workDir, { recursive: true, force: true });
}

function assertInstalled() {
  const installed = jsonOutput(['plugin', 'list', '--json']);
  const matches = installed.filter((plugin) => plugin.id === pluginId);
  if (matches.length !== 1 || !matches[0].enabled) {
    throw new Error(`Expected one enabled ${pluginId} installation`);
  }

  const installedRoot = resolve(matches[0].installPath);
  if (!installedRoot.startsWith(`${resolve(configDir)}${sep}`)) {
    throw new Error('Claude installed the plugin outside the isolated config directory');
  }

  const manifest = jsonFile(join(installedRoot, '.claude-plugin/plugin.json'));
  if (manifest.name !== 'aictrl' || manifest.version !== matches[0].version) {
    throw new Error('Installed Claude manifest does not match the plugin listing');
  }

  const mcp = jsonFile(join(installedRoot, '.mcp.json'));
  if (mcp.mcpServers?.aictrl?.url !== 'https://aictrl.dev/mcp/workflows') {
    throw new Error('Installed Claude plugin does not target the production workflow MCP');
  }

  const skillsRoot = join(installedRoot, 'skills');
  const installedSkills = readdirSync(skillsRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
  if (JSON.stringify(installedSkills) !== JSON.stringify(expectedSkills)) {
    throw new Error(`Installed Claude skills differ: ${installedSkills.join(', ')}`);
  }
  for (const skill of expectedSkills) {
    if (!existsSync(join(skillsRoot, skill, 'SKILL.md'))) {
      throw new Error(`Installed Claude skill is missing SKILL.md: ${skill}`);
    }
  }
}

function run(args) {
  try {
    return execFileSync(claude, args, {
      cwd: workDir,
      env,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch (error) {
    const stderr = error?.stderr?.toString?.() || '';
    const stdout = error?.stdout?.toString?.() || '';
    const detail = stderr.trim() || stdout.trim();
    throw new Error(`claude ${args.join(' ')} failed${detail ? `: ${detail}` : ''}`);
  }
}

function jsonOutput(args) {
  return JSON.parse(run(args));
}

function jsonFile(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}
