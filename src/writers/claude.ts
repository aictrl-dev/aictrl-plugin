import { writeFile, mkdir, readFile, chmod, rm } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import { writeSkill, clearSkillsDir, type WritableSkill } from './shared.js';
import { generateClaudeHook } from '../hooks/claude.sh.js';
import { generateClaudeSlashCommandHook } from '../hooks/claude-slash.sh.js';

export interface ClaudePluginOptions {
  orgSlug: string;
  skills: WritableSkill[];
  apiKey: string;
  baseUrl: string;
  pluginsRoot: string;
  settingsFile: string;
}

const MARKETPLACE_NAME = 'aictrl';
const PLUGIN_VERSION = '1.0.0';

interface InstalledPluginEntry {
  scope: string;
  installPath: string;
  version: string;
  installedAt: string;
  lastUpdated: string;
}

interface InstalledPluginsFile {
  version: number;
  plugins: Record<string, InstalledPluginEntry[]>;
}

export async function installClaudePlugin(options: ClaudePluginOptions): Promise<void> {
  const { orgSlug, skills, apiKey, baseUrl, pluginsRoot, settingsFile } = options;
  const pluginId = `aictrl-${orgSlug}`;
  const pluginDirName = `${pluginId}@${MARKETPLACE_NAME}`;

  // Canonical Claude Code layout: plugins live under their marketplace dir so the
  // marketplace.json manifest can declare them via a relative "source" field.
  const marketplaceDir = join(pluginsRoot, 'marketplaces', MARKETPLACE_NAME);
  const pluginDir = join(marketplaceDir, 'plugins', pluginId);
  const skillsDir = join(pluginDir, 'skills');

  // Pre-v2.2 of this installer wrote the plugin to ~/.claude/plugins/cache/<plugin>@aictrl/
  // without registering the `aictrl` marketplace, leaving Claude Code unable to resolve
  // the enablement entry. Remove that stale directory on upgrade (#18).
  const legacyCacheDir = join(pluginsRoot, 'cache', pluginDirName);
  if (existsSync(legacyCacheDir)) {
    await rm(legacyCacheDir, { recursive: true, force: true });
  }

  // Clear and recreate skills directory
  await clearSkillsDir(skillsDir);

  // Write plugin.json
  const pluginJsonDir = join(pluginDir, '.claude-plugin');
  await mkdir(pluginJsonDir, { recursive: true });
  await writeFile(
    join(pluginJsonDir, 'plugin.json'),
    JSON.stringify(
      {
        name: pluginId,
        description: `aictrl skills for ${orgSlug}`,
        version: PLUGIN_VERSION,
        author: { name: 'aictrl.dev' },
        homepage: 'https://aictrl.dev',
        mcpServers: './.mcp.json',
        hooks: './hooks/hooks.json',
      },
      null,
      2,
    ) + '\n',
    'utf-8',
  );

  // Write .mcp.json
  await writeFile(
    join(pluginDir, '.mcp.json'),
    JSON.stringify(
      {
        mcpServers: {
          [pluginId]: {
            type: 'http',
            url: `${baseUrl}/${orgSlug}/mcp`,
            headers: { Authorization: `Bearer ${apiKey}` },
          },
        },
      },
      null,
      2,
    ) + '\n',
    'utf-8',
  );
  await chmod(join(pluginDir, '.mcp.json'), 0o600);

  // Write skills
  for (const skill of skills) {
    await writeSkill(skillsDir, skill);
  }

  // Write telemetry hook
  const hooksDir = join(pluginDir, 'hooks');
  await mkdir(hooksDir, { recursive: true });
  await writeFile(join(hooksDir, 'skill-telemetry.sh'), generateClaudeHook(baseUrl), {
    mode: 0o755,
  });
  await writeFile(
    join(hooksDir, 'slash-command-telemetry.sh'),
    generateClaudeSlashCommandHook(baseUrl),
    { mode: 0o755 },
  );
  await writeFile(
    join(hooksDir, 'hooks.json'),
    JSON.stringify(
      {
        hooks: {
          PostToolUse: [
            {
              matcher: 'Read',
              hooks: [
                {
                  type: 'command',
                  command: '${CLAUDE_PLUGIN_ROOT}/hooks/skill-telemetry.sh',
                },
              ],
            },
          ],
          UserPromptSubmit: [
            {
              hooks: [
                {
                  type: 'command',
                  command: '${CLAUDE_PLUGIN_ROOT}/hooks/slash-command-telemetry.sh',
                },
              ],
            },
          ],
        },
      },
      null,
      2,
    ) + '\n',
    'utf-8',
  );

  // Write the marketplace manifest so Claude Code can resolve `<plugin>@aictrl`
  // enablement entries (#18).
  await writeMarketplaceManifest(marketplaceDir, pluginId, orgSlug);

  // Register the marketplace + install with Claude Code's plugin index files.
  await mergeKnownMarketplace(pluginsRoot, marketplaceDir);
  await mergeInstalledPlugin(pluginsRoot, pluginDirName, pluginDir);

  // Register plugin in settings.json
  await mergeSettings(settingsFile, pluginDirName);
}

async function writeMarketplaceManifest(
  marketplaceDir: string,
  pluginId: string,
  orgSlug: string,
): Promise<void> {
  const manifestDir = join(marketplaceDir, '.claude-plugin');
  const manifestPath = join(manifestDir, 'marketplace.json');
  await mkdir(manifestDir, { recursive: true });

  // Preserve any other plugins that might already be declared in the manifest
  // (future-proofing — currently we only ship one plugin per org).
  let manifest: { name: string; owner: { name: string }; plugins: unknown[] } = {
    name: MARKETPLACE_NAME,
    owner: { name: 'aictrl' },
    plugins: [],
  };
  try {
    const parsed = JSON.parse(await readFile(manifestPath, 'utf-8'));
    if (parsed && typeof parsed === 'object') {
      manifest = { ...manifest, ...parsed };
      if (!Array.isArray(manifest.plugins)) manifest.plugins = [];
    }
  } catch {
    // No existing manifest — start fresh.
  }

  const pluginSpec = {
    name: pluginId,
    source: `./plugins/${pluginId}`,
    description: `aictrl skills for ${orgSlug}`,
    version: PLUGIN_VERSION,
  };
  const others = manifest.plugins.filter(
    (p): p is { name: string } =>
      typeof p === 'object' && p !== null && (p as { name?: string }).name !== pluginId,
  );
  manifest.plugins = [...others, pluginSpec];

  await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + '\n', 'utf-8');
}

async function mergeKnownMarketplace(
  pluginsRoot: string,
  marketplaceDir: string,
): Promise<void> {
  const file = join(pluginsRoot, 'known_marketplaces.json');
  let data: Record<string, unknown> = {};
  try {
    const parsed = JSON.parse(await readFile(file, 'utf-8'));
    if (parsed && typeof parsed === 'object') data = parsed;
  } catch {
    // No existing file or malformed — start fresh.
  }

  data[MARKETPLACE_NAME] = {
    source: { source: 'local', path: marketplaceDir },
    installLocation: marketplaceDir,
    lastUpdated: new Date().toISOString(),
  };

  await mkdir(pluginsRoot, { recursive: true });
  await writeFile(file, JSON.stringify(data, null, 2) + '\n', 'utf-8');
}

async function mergeInstalledPlugin(
  pluginsRoot: string,
  pluginKey: string,
  installPath: string,
): Promise<void> {
  const file = join(pluginsRoot, 'installed_plugins.json');
  let data: InstalledPluginsFile = { version: 2, plugins: {} };
  try {
    const parsed = JSON.parse(await readFile(file, 'utf-8'));
    if (parsed && typeof parsed === 'object') {
      data = {
        version: typeof parsed.version === 'number' ? parsed.version : 2,
        plugins:
          parsed.plugins && typeof parsed.plugins === 'object' ? parsed.plugins : {},
      };
    }
  } catch {
    // No existing file or malformed — start fresh.
  }

  const now = new Date().toISOString();
  const existing = data.plugins[pluginKey]?.[0];
  data.plugins[pluginKey] = [
    {
      scope: 'user',
      installPath,
      version: PLUGIN_VERSION,
      installedAt: existing?.installedAt ?? now,
      lastUpdated: now,
    },
  ];

  await mkdir(pluginsRoot, { recursive: true });
  await writeFile(file, JSON.stringify(data, null, 2) + '\n', 'utf-8');
}

async function mergeSettings(settingsFile: string, pluginDirName: string): Promise<void> {
  let settings: Record<string, unknown> = {};
  try {
    const content = await readFile(settingsFile, 'utf-8');
    settings = JSON.parse(content);
  } catch {
    // File doesn't exist or is invalid — start fresh
  }

  const enabledPlugins = (settings.enabledPlugins ?? {}) as Record<string, boolean>;
  enabledPlugins[pluginDirName] = true;
  settings.enabledPlugins = enabledPlugins;

  await mkdir(join(settingsFile, '..'), { recursive: true });
  await writeFile(settingsFile, JSON.stringify(settings, null, 2) + '\n', 'utf-8');
}
