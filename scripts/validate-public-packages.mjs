#!/usr/bin/env node
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const errors = [];

const plugin = json('plugins/aictrl/.codex-plugin/plugin.json');
const marketplace = json('.agents/plugins/marketplace.json');
const mcp = json('plugins/aictrl/.mcp.json');
const opencode = json('opencode/package.json');

required(plugin, ['name', 'version', 'description', 'author', 'skills', 'mcpServers', 'interface']);
if (plugin.name !== 'aictrl') errors.push('Codex plugin name must be aictrl');
if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(plugin.version)) {
  errors.push('Codex plugin version must be strict semver');
}
for (const field of ['skills', 'mcpServers']) {
  const value = plugin[field];
  if (typeof value !== 'string' || !value.startsWith('./')) errors.push(`${field} must be a ./ relative path`);
  else if (!existsSync(join(root, 'plugins/aictrl', value))) errors.push(`${field} path does not exist: ${value}`);
}
for (const field of ['composerIcon', 'logo']) {
  const value = plugin.interface?.[field];
  if (typeof value !== 'string' || !existsSync(join(root, 'plugins/aictrl', value))) {
    errors.push(`interface.${field} must point to an existing asset`);
  }
}
const prompts = plugin.interface?.defaultPrompt;
if (!Array.isArray(prompts) || prompts.length === 0 || prompts.length > 3) {
  errors.push('interface.defaultPrompt must contain one to three prompts');
} else if (prompts.some((prompt) => typeof prompt !== 'string' || prompt.length > 128)) {
  errors.push('Every starter prompt must be a string no longer than 128 characters');
}
for (const urlField of ['websiteURL', 'privacyPolicyURL', 'termsOfServiceURL']) {
  if (!/^https:\/\//.test(plugin.interface?.[urlField] || '')) {
    errors.push(`interface.${urlField} must be an absolute HTTPS URL`);
  }
}

const entry = marketplace.plugins?.find((candidate) => candidate.name === 'aictrl');
if (!entry) errors.push('Codex marketplace is missing aictrl');
else {
  if (entry.source?.path !== './plugins/aictrl') errors.push('Codex marketplace path is incorrect');
  if (!['AVAILABLE', 'INSTALLED_BY_DEFAULT', 'NOT_AVAILABLE'].includes(entry.policy?.installation)) {
    errors.push('Codex marketplace installation policy is invalid');
  }
  if (!['ON_INSTALL', 'ON_USE'].includes(entry.policy?.authentication)) {
    errors.push('Codex marketplace authentication policy is invalid');
  }
  if (typeof entry.category !== 'string' || !entry.category) errors.push('Codex marketplace category is required');
}

if (mcp.mcpServers?.aictrl?.url !== 'https://aictrl.dev/mcp/workflows') {
  errors.push('Codex MCP must target the dedicated workflow endpoint');
}
if (opencode.name !== '@aictrl/opencode' || opencode.bin?.['aictrl-opencode'] !== 'bin/install.js') {
  errors.push('OpenCode npm package metadata is invalid');
}

const testCases = readFileSync(join(root, 'submission/codex/test-cases.md'), 'utf8');
if ((testCases.match(/^### P\d+ /gm) || []).length !== 5) errors.push('Codex reviewer pack must contain exactly five positive cases');
if ((testCases.match(/^### N\d+ /gm) || []).length !== 3) errors.push('Codex reviewer pack must contain exactly three negative cases');

for (const directory of ['claude', 'plugins', 'opencode', 'submission']) {
  for (const file of walk(join(root, directory))) {
    const content = readFileSync(file, 'utf8');
    if (/\[TODO:[^\]]+\]/.test(content)) errors.push(`TODO placeholder found: ${file}`);
    if (/(github_pat_[A-Za-z0-9_]{20,}|gh[pousr]_[A-Za-z0-9]{20,}|sk-[A-Za-z0-9]{20,}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----)/.test(content)) {
      errors.push(`Potential secret found: ${file}`);
    }
  }
}

if (errors.length) {
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}
console.log('Validated public Claude, Codex, and OpenCode package metadata.');

function json(path) {
  try {
    return JSON.parse(readFileSync(join(root, path), 'utf8'));
  } catch (error) {
    errors.push(`${path}: ${error.message}`);
    return {};
  }
}

function required(object, fields) {
  for (const field of fields) if (object[field] == null) errors.push(`Codex manifest requires ${field}`);
}

function walk(directory) {
  const files = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...walk(path));
    else if (entry.isFile()) files.push(path);
  }
  return files;
}
