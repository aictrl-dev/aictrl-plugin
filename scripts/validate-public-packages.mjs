#!/usr/bin/env node
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const errors = [];

const plugin = json('plugins/aictrl/.codex-plugin/plugin.json');
const marketplace = json('.agents/plugins/marketplace.json');
const mcp = json('plugins/aictrl/.mcp.json');
const claudeMcp = json('claude/aictrl/.mcp.json');
const opencode = json('opencode/package.json');
const opencodeSkills = json('opencode/skills-manifest.json');
const claudePlugin = json('claude/aictrl/.claude-plugin/plugin.json');
const claudeMarketplace = json('.claude-plugin/marketplace.json');
const publicSkillsLock = json('public-skills.lock.json');

required(plugin, ['name', 'version', 'description', 'author', 'skills', 'mcpServers', 'interface']);
if (plugin.name !== 'aictrl') errors.push('Codex plugin name must be aictrl');
if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(plugin.version)) {
  errors.push('Codex plugin version must be strict semver');
}
const publicVersion = opencode.version;
if (plugin.version !== publicVersion) {
  errors.push('Codex and OpenCode public package versions must match');
}
if (claudePlugin.version !== publicVersion) {
  errors.push('Claude and OpenCode public package versions must match');
}
const claudeEntry = claudeMarketplace.plugins?.find((candidate) => candidate.name === 'aictrl');
if (claudeEntry?.version !== publicVersion) {
  errors.push('Claude marketplace and public package versions must match');
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

if (
  mcp.mcpServers?.aictrl?.url
  !== publicMcpUrl()
) {
  errors.push('Codex MCP must target the canonical public workflow endpoint');
}
if (
  claudeMcp.mcpServers?.aictrl?.url
  !== publicMcpUrl()
) {
  errors.push('Claude MCP must target the canonical public workflow endpoint');
}
if (opencode.name !== '@aictrl/opencode' || opencode.bin?.['aictrl-opencode'] !== 'bin/install.js') {
  errors.push('OpenCode npm package metadata is invalid');
}
if (
  opencodeSkills.skillsVersion !== publicSkillsLock.skillsVersion
  || JSON.stringify(opencodeSkills.skills) !== JSON.stringify(publicSkillsLock.skills)
) {
  errors.push('OpenCode skills manifest must match the pinned public skills release');
}

const testCases = readFileSync(join(root, 'submission/codex/test-cases.md'), 'utf8');
const listing = readFileSync(join(root, 'submission/codex/listing.md'), 'utf8');
for (const value of [
  plugin.interface?.displayName,
  plugin.interface?.shortDescription,
  plugin.interface?.longDescription,
  plugin.interface?.developerName,
  plugin.interface?.category,
  plugin.interface?.websiteURL,
  plugin.interface?.privacyPolicyURL,
  plugin.interface?.termsOfServiceURL,
  plugin.interface?.brandColor,
  plugin.interface?.logo,
  publicMcpUrl(),
  'https://aictrl.dev/support',
]) {
  if (typeof value !== 'string' || !value || !listing.includes(`\`${value}\``)) {
    errors.push(`Codex submission listing is missing the manifest-matched value: ${value}`);
  }
}
for (const prompt of prompts || []) {
  if (!listing.includes(`\`${prompt}\``)) {
    errors.push(`Codex submission listing is missing starter prompt: ${prompt}`);
  }
}
if (!listing.includes('| Browser fetch domains | None |')) {
  errors.push('Codex submission listing must record that the no-custom-UI bundle has no browser fetch domains');
}
if (existsSync(join(root, 'plugins/aictrl/.app.json'))) {
  errors.push('Codex submission listing declares no custom UI, but plugins/aictrl/.app.json exists');
}
const logoPath = join(root, 'plugins/aictrl', plugin.interface?.logo || '__missing_logo__');
if (existsSync(logoPath)) {
  const logo = readFileSync(logoPath, 'utf8');
  if (/<(?:script|foreignObject|text|filter)\b|(?:href|xlink:href)\s*=|url\s*\(/i.test(logo)) {
    errors.push('Codex production logo must not contain script, external resources, embedded text, or filters');
  }
}
for (const fixturePath of [
  'submission/codex/reviewer-fixture.md',
  'submission/codex/fixture-template/issue.md',
  'submission/codex/fixture-template/repository/LICENSE',
  'submission/codex/fixture-template/repository/package.json',
  'submission/codex/fixture-template/repository/src/labels.mjs',
  'submission/codex/fixture-template/repository/test/labels.test.mjs',
]) {
  if (!existsSync(join(root, fixturePath))) errors.push(`Codex reviewer fixture file is required: ${fixturePath}`);
}
if ((testCases.match(/^### P\d+ /gm) || []).length !== 5) errors.push('Codex reviewer pack must contain exactly five positive cases');
if ((testCases.match(/^### N\d+ /gm) || []).length !== 3) errors.push('Codex reviewer pack must contain exactly three negative cases');
if ((testCases.match(/^- Fixture\/account:/gm) || []).length !== 5) {
  errors.push('Every positive Codex reviewer case must declare fixture/account requirements');
}
if (!testCases.includes('reviewer-fixture.md')) errors.push('Codex reviewer cases must reference the fixture specification');
if (/\bissue_id\b/.test(testCases)) errors.push('Codex reviewer pack must use the canonical issue-id workflow input');
if (!/\bissue-id\b/.test(testCases)) errors.push('Codex reviewer pack must exercise the canonical issue-id workflow input');

const opencodeEcosystem = readFileSync(join(root, 'submission/opencode/ecosystem.md'), 'utf8');
for (const requiredText of [
  'anomalyco/opencode',
  'packages/web/src/content/docs/ecosystem.mdx',
  'npm view @aictrl/opencode version dist-tags --json',
  '[@aictrl/opencode](https://github.com/aictrl-dev/aictrl-plugin/tree/main/opencode)',
  '### Issue for this PR',
  '### Type of change',
  'Closes #<upstream-issue>',
]) {
  if (!opencodeEcosystem.includes(requiredText)) errors.push(`OpenCode Ecosystem submission is missing: ${requiredText}`);
}

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

function publicMcpUrl() {
  return 'https://aictrl.dev/mcp';
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
