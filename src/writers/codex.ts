import { chmod, cp, mkdir, readFile, rename, rm, writeFile } from 'fs/promises';
import { dirname, join } from 'path';
import { clearSkillsDir, writeSkill, type WritableSkill } from './shared.js';

export interface CodexOptions {
  orgSlug: string;
  skills: WritableSkill[];
  baseUrl: string;
  codexConfigFile: string;
  codexMarketplaceFile: string;
}

const PLUGIN_VERSION = '1.0.0';
const MARKETPLACE_NAME = 'personal';
const MARKETPLACE_DISPLAY_NAME = 'Personal';
const ORG_SLUG_REGEX = /^[a-z0-9][a-z0-9-]{0,62}$/;
const AICTRL_API_KEY_ENV = 'AICTRL_API_KEY';

interface CodexMarketplace {
  name: string;
  interface: {
    displayName: string;
    [key: string]: unknown;
  };
  plugins: unknown[];
  [key: string]: unknown;
}

export async function installCodex(options: CodexOptions): Promise<void> {
  const { orgSlug, skills, baseUrl, codexConfigFile, codexMarketplaceFile } = options;
  if (!ORG_SLUG_REGEX.test(orgSlug)) {
    throw new Error(
      `Invalid orgSlug "${orgSlug}": must match ${ORG_SLUG_REGEX} (lowercase alphanumeric and hyphens, 1-63 chars).`,
    );
  }

  const pluginId = `aictrl-${orgSlug}`;
  const marketplaceRoot = dirname(codexMarketplaceFile);
  const personalMarketplaceRoot = dirname(dirname(marketplaceRoot));
  const pluginDir = join(personalMarketplaceRoot, 'plugins', pluginId);
  const legacyPluginDir = join(marketplaceRoot, 'plugins', pluginId);
  const skillsDir = join(pluginDir, 'skills');
  const pluginCacheDir = join(
    dirname(codexConfigFile),
    'plugins',
    'cache',
    MARKETPLACE_NAME,
    pluginId,
    PLUGIN_VERSION,
  );

  await clearSkillsDir(skillsDir);
  for (const skill of skills) {
    await writeSkill(skillsDir, skill);
  }

  await writePluginManifest(pluginDir, pluginId, orgSlug);
  await rm(legacyPluginDir, { recursive: true, force: true });
  await mergeMarketplace(codexMarketplaceFile, pluginId);
  await installPluginCache(pluginDir, pluginCacheDir);
  await mergeCodexMcpConfig(codexConfigFile, orgSlug, baseUrl);
  await mergeCodexPluginConfig(codexConfigFile, pluginId);
}

async function writePluginManifest(
  pluginDir: string,
  pluginId: string,
  orgSlug: string,
): Promise<void> {
  const manifestDir = join(pluginDir, '.codex-plugin');
  await mkdir(manifestDir, { recursive: true });
  await writeFile(
    join(manifestDir, 'plugin.json'),
    JSON.stringify(
      {
        name: pluginId,
        version: PLUGIN_VERSION,
        description: `aictrl skills for ${orgSlug}`,
        author: { name: 'aictrl.dev', url: 'https://aictrl.dev' },
        homepage: 'https://aictrl.dev',
        license: 'MIT',
        keywords: ['aictrl', 'skills', 'mcp'],
        skills: './skills/',
        interface: {
          displayName: `aictrl ${orgSlug}`,
          shortDescription: `aictrl skills and MCP for ${orgSlug}`,
          longDescription:
            'Installs aictrl skills for Codex and connects Codex to the aictrl MCP server using environment-backed authentication.',
          developerName: 'aictrl.dev',
          category: 'Productivity',
          capabilities: ['Write', 'MCP'],
          websiteURL: 'https://aictrl.dev',
          defaultPrompt: [
            'Use the aictrl skills for this repository.',
            'Connect to the aictrl MCP context.',
          ],
        },
      },
      null,
      2,
    ) + '\n',
    'utf-8',
  );
}

async function mergeMarketplace(marketplaceFile: string, pluginId: string): Promise<void> {
  const marketplaceRoot = dirname(marketplaceFile);
  let marketplace: CodexMarketplace = {
    name: MARKETPLACE_NAME,
    interface: { displayName: MARKETPLACE_DISPLAY_NAME },
    plugins: [],
  };

  try {
    const parsed = JSON.parse(await readFile(marketplaceFile, 'utf-8'));
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      marketplace = {
        ...marketplace,
        ...(parsed as Record<string, unknown>),
        interface: {
          ...marketplace.interface,
          ...((parsed as { interface?: unknown }).interface &&
          typeof (parsed as { interface?: unknown }).interface === 'object' &&
          !Array.isArray((parsed as { interface?: unknown }).interface)
            ? ((parsed as { interface: Record<string, unknown> }).interface)
            : {}),
        },
        plugins: Array.isArray((parsed as { plugins?: unknown }).plugins)
          ? (parsed as { plugins: unknown[] }).plugins
          : [],
      };
    }
  } catch {
    // No existing marketplace or malformed JSON: write a valid personal marketplace.
  }

  marketplace.name = typeof marketplace.name === 'string' ? marketplace.name : MARKETPLACE_NAME;
  marketplace.interface = marketplace.interface ?? { displayName: MARKETPLACE_DISPLAY_NAME };
  if (typeof marketplace.interface.displayName !== 'string') {
    marketplace.interface.displayName = MARKETPLACE_DISPLAY_NAME;
  }

  const entry = {
    name: pluginId,
    source: {
      source: 'local',
      path: `./plugins/${pluginId}`,
    },
    policy: {
      installation: 'INSTALLED_BY_DEFAULT',
      authentication: 'ON_USE',
    },
    category: 'Productivity',
  };

  const others = marketplace.plugins.filter(
    (plugin): plugin is Record<string, unknown> =>
      typeof plugin === 'object' &&
      plugin !== null &&
      (plugin as { name?: unknown }).name !== pluginId,
  );
  marketplace.plugins = [...others, entry];

  await mkdir(marketplaceRoot, { recursive: true });
  await writeJsonAtomic(marketplaceFile, marketplace);
}

async function installPluginCache(pluginDir: string, pluginCacheDir: string): Promise<void> {
  await rm(pluginCacheDir, { recursive: true, force: true });
  await mkdir(dirname(pluginCacheDir), { recursive: true });
  await cp(pluginDir, pluginCacheDir, { recursive: true });
}

async function mergeCodexMcpConfig(
  codexConfigFile: string,
  orgSlug: string,
  baseUrl: string,
): Promise<void> {
  const serverName = `aictrl-${orgSlug}`;
  const block = [
    `[mcp_servers.${serverName}]`,
    `url = ${tomlString(`${baseUrl}/${orgSlug}/mcp`)}`,
    `bearer_token_env_var = ${tomlString(AICTRL_API_KEY_ENV)}`,
  ].join('\n');

  let content = '';
  try {
    content = await readFile(codexConfigFile, 'utf-8');
  } catch {
    // No existing config: create it below.
  }

  const next = replaceTomlTable(content, `mcp_servers.${serverName}`, block);
  await mkdir(dirname(codexConfigFile), { recursive: true });
  await writeFileAtomic(codexConfigFile, next);
  await chmod(codexConfigFile, 0o600);
}

async function mergeCodexPluginConfig(codexConfigFile: string, pluginId: string): Promise<void> {
  const pluginKey = `${pluginId}@${MARKETPLACE_NAME}`;
  const tableName = `plugins.${tomlString(pluginKey)}`;
  const block = [`[${tableName}]`, 'enabled = true'].join('\n');

  let content = '';
  try {
    content = await readFile(codexConfigFile, 'utf-8');
  } catch {
    // No existing config: create it below.
  }

  const next = replaceTomlTable(content, tableName, block);
  await mkdir(dirname(codexConfigFile), { recursive: true });
  await writeFileAtomic(codexConfigFile, next);
  await chmod(codexConfigFile, 0o600);
}

function replaceTomlTable(content: string, tableName: string, replacement: string): string {
  const lines = content.split(/\r?\n/);
  const headerPattern = new RegExp(`^\\s*\\[${escapeRegExp(tableName)}\\]\\s*$`);
  const nextHeaderPattern = /^\s*\[[^\]]+\]\s*$/;
  const start = lines.findIndex((line) => headerPattern.test(line));

  if (start === -1) {
    const trimmed = content.trimEnd();
    return `${trimmed}${trimmed ? '\n\n' : ''}${replacement}\n`;
  }

  let end = start + 1;
  while (end < lines.length && !nextHeaderPattern.test(lines[end])) {
    end += 1;
  }

  const updated = [...lines.slice(0, start), replacement, ...lines.slice(end)].join('\n');
  return updated.endsWith('\n') ? updated : `${updated}\n`;
}

function tomlString(value: string): string {
  return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function writeJsonAtomic(filePath: string, data: unknown): Promise<void> {
  await writeFileAtomic(filePath, JSON.stringify(data, null, 2) + '\n');
}

async function writeFileAtomic(filePath: string, content: string): Promise<void> {
  const tmp = `${filePath}.tmp`;
  await rm(tmp, { force: true });
  await writeFile(tmp, content, 'utf-8');
  await rename(tmp, filePath);
}
