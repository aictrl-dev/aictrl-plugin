#!/usr/bin/env node
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = new Set(process.argv.slice(2));
const projectIndex = process.argv.indexOf('--project');
const projectRoot = projectIndex === -1 ? null : process.argv[projectIndex + 1];
if (projectIndex !== -1 && !projectRoot) fail('--project requires a directory');

const configRoot = projectRoot
  ? resolve(projectRoot, '.opencode')
  : join(process.env.XDG_CONFIG_HOME || join(homedir(), '.config'), 'opencode');
const skillsRoot = join(configRoot, 'skills');
const configFile = projectRoot ? resolve(projectRoot, 'opencode.json') : join(configRoot, 'opencode.json');
const sourceSkills = join(packageRoot, 'skills');
const skillsManifest = readSkillsManifest(sourceSkills);
const packageMetadata = readPackageMetadata();
const skillNames = [...new Set(skillsManifest.skills)].sort();
const mcpUrl = publicMcpUrl(packageMetadata.version, skillsManifest.skillsVersion);

if (args.has('--uninstall')) {
  for (const skill of skillNames) rmSync(join(skillsRoot, skill), { recursive: true, force: true });
  const config = readConfig(configFile);
  if (config.mcp && typeof config.mcp === 'object' && !Array.isArray(config.mcp)) {
    delete config.mcp.aictrl;
    if (Object.keys(config.mcp).length === 0) delete config.mcp;
    writeJson(configFile, config);
  }
  console.log(`Removed AICtrl skills and MCP config from ${projectRoot ? 'this project' : 'OpenCode'}.`);
  process.exit(0);
}

mkdirSync(skillsRoot, { recursive: true });
for (const skill of skillNames) {
  const target = join(skillsRoot, skill);
  rmSync(target, { recursive: true, force: true });
  cpSync(join(sourceSkills, skill), target, { recursive: true });
}

const config = readConfig(configFile);
const mcp = config.mcp && typeof config.mcp === 'object' && !Array.isArray(config.mcp)
  ? config.mcp
  : {};
mcp.aictrl = {
  type: 'remote',
  url: mcpUrl,
  enabled: true,
};
config.$schema ||= 'https://opencode.ai/config.json';
config.mcp = mcp;
writeJson(configFile, config);

console.log(`Installed ${skillNames.length} AICtrl skills and OAuth MCP config.`);
console.log('Start a new OpenCode session, then run: opencode mcp auth aictrl');

function readSkillsManifest(directory) {
  if (!existsSync(directory)) fail('Bundled skills are missing; reinstall the package.');
  const manifest = JSON.parse(readFileSync(new URL('../skills-manifest.json', import.meta.url), 'utf8'));
  if (
    !manifest
    || typeof manifest !== 'object'
    || !Array.isArray(manifest.skills)
    || manifest.skills.some((name) => typeof name !== 'string')
    || !isVersion(manifest.skillsVersion)
  ) {
    fail('Bundled skills manifest is invalid; reinstall the package.');
  }
  return manifest;
}

function readPackageMetadata() {
  const metadata = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  if (metadata.name !== '@aictrl/opencode' || !isVersion(metadata.version)) {
    fail('Package metadata is invalid; reinstall the package.');
  }
  return metadata;
}

function publicMcpUrl(pluginVersion, skillsVersion) {
  return `https://aictrl.dev/mcp/workflows/opencode-ecosystem/${pluginVersion}/implement-code-change/${skillsVersion}`;
}

function isVersion(value) {
  return typeof value === 'string' && /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(value);
}

function readConfig(file) {
  if (!existsSync(file)) return {};
  try {
    const parsed = JSON.parse(readFileSync(file, 'utf8'));
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) fail(`${file} must contain a JSON object`);
    return parsed;
  } catch (error) {
    fail(`Cannot parse ${file}: ${error.message}`);
  }
}

function writeJson(file, value) {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
}

function fail(message) {
  console.error(`aictrl-opencode: ${message}`);
  process.exit(1);
}
