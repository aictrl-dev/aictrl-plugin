import { writeFile, mkdir, readFile, chmod, rm, rename } from 'fs/promises';
import { join } from 'path';
import { writeSkill, clearSkillsDir, type WritableSkill } from './shared.js';
import { generateClaudeHook } from '../hooks/claude.sh.js';
import { generateClaudeSlashCommandHook } from '../hooks/claude-slash.sh.js';
import { ensureGitignore } from '../gitignore.js';

export interface ClaudePluginOptions {
  orgSlug: string;
  skills: WritableSkill[];
  apiKey: string;
  baseUrl: string;
  pluginsRoot: string;
  /** Project root; enablement is written to `<projectDir>/.claude/settings.local.json`. */
  projectDir: string;
  /** Path to `~/.claude/settings.json`; consulted only to clean up legacy user-scope enablement entries. */
  userSettingsFile: string;
}

// Forward-slash literal: this value is written verbatim into the project
// .gitignore, which only matches POSIX-style separators. Node's path API
// happily accepts forward slashes on Windows for filesystem operations.
const PROJECT_SETTINGS_RELPATH = '.claude/settings.local.json';

const MARKETPLACE_NAME = 'aictrl';
const PLUGIN_VERSION = '1.0.0';

// orgSlug is interpolated into filesystem paths, URLs, MCP server names and
// shell hooks. Reject anything that could escape the plugin tree or hijack
// path resolution. Mirrors the slug shape published by aictrl.dev.
const ORG_SLUG_REGEX = /^[a-z0-9][a-z0-9-]{0,62}$/;

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
  const { orgSlug, skills, apiKey, baseUrl, pluginsRoot, projectDir, userSettingsFile } = options;
  if (!ORG_SLUG_REGEX.test(orgSlug)) {
    throw new Error(
      `Invalid orgSlug "${orgSlug}": must match ${ORG_SLUG_REGEX} (lowercase alphanumeric and hyphens, 1–63 chars).`,
    );
  }
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
  // rm with force:true is a no-op when the path is missing, so no existsSync check needed.
  const legacyCacheDir = join(pluginsRoot, 'cache', pluginDirName);
  await rm(legacyCacheDir, { recursive: true, force: true });

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

  // Enable the plugin in PROJECT scope so each repo gets only its own org's
  // MCP + skills (#20). Pre-#20 versions wrote enablement to user scope, which
  // loaded every installed org in every Claude Code session.
  const projectSettingsFile = join(projectDir, PROJECT_SETTINGS_RELPATH);
  await mergeSettings(projectSettingsFile, pluginDirName);

  // Migration: remove this org's enablement entry from user-scope settings.json
  // if a pre-#20 install put it there. Leaves unrelated entries (incl. other
  // orgs, which get migrated when their own repo is installed) alone.
  // Runs unconditionally every install — cheap (one small file read) and self-
  // healing if a stale entry returns via backup restore or manual edit.
  await removeUserScopeEnablement(userSettingsFile, pluginDirName);

  // The project settings.local.json file is per-developer; gitignore it so
  // committing the repo does not leak enablement state across the team.
  await ensureGitignore(projectDir, [PROJECT_SETTINGS_RELPATH]);
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
    // typeof [] === 'object', so guard against an array-shaped file
    // polluting the manifest with numeric-indexed keys.
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
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
    // typeof [] === 'object' — refuse an array-shaped file so that the named
    // property we assign below isn't silently dropped by JSON.stringify.
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      data = parsed as Record<string, unknown>;
    }
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
    if (
      parsed &&
      typeof parsed === 'object' &&
      !Array.isArray(parsed)
    ) {
      data = {
        version: typeof parsed.version === 'number' ? parsed.version : 2,
        plugins:
          parsed.plugins && typeof parsed.plugins === 'object' && !Array.isArray(parsed.plugins)
            ? parsed.plugins
            : {},
      };
    }
  } catch {
    // No existing file or malformed — start fresh.
  }

  const now = new Date().toISOString();
  const existingEntries = Array.isArray(data.plugins[pluginKey]) ? data.plugins[pluginKey] : [];
  const existingUser = existingEntries.find((e) => e?.scope === 'user');
  // Replace only the user-scope entry; preserve any other-scope entries that
  // a future Claude Code version (or another install path) might have written.
  const otherScopes = existingEntries.filter((e) => e?.scope !== 'user');
  data.plugins[pluginKey] = [
    ...otherScopes,
    {
      scope: 'user',
      installPath,
      version: PLUGIN_VERSION,
      installedAt: existingUser?.installedAt ?? now,
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
    const parsed = JSON.parse(content);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      settings = parsed as Record<string, unknown>;
    }
  } catch {
    // File doesn't exist or is invalid — start fresh
  }

  const enabledPlugins = (settings.enabledPlugins ?? {}) as Record<string, boolean>;
  enabledPlugins[pluginDirName] = true;
  settings.enabledPlugins = enabledPlugins;

  await mkdir(join(settingsFile, '..'), { recursive: true });
  await writeJsonAtomic(settingsFile, settings);
}

async function removeUserScopeEnablement(
  userSettingsFile: string,
  pluginDirName: string,
): Promise<void> {
  let content: string;
  try {
    content = await readFile(userSettingsFile, 'utf-8');
  } catch {
    // No user settings file — nothing to migrate.
    return;
  }

  let settings: Record<string, unknown>;
  try {
    const parsed = JSON.parse(content);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return;
    settings = parsed as Record<string, unknown>;
  } catch {
    // Malformed user settings — don't touch it.
    return;
  }

  const enabledPlugins = settings.enabledPlugins;
  if (
    !enabledPlugins ||
    typeof enabledPlugins !== 'object' ||
    Array.isArray(enabledPlugins) ||
    !(pluginDirName in (enabledPlugins as Record<string, unknown>))
  ) {
    return;
  }

  delete (enabledPlugins as Record<string, unknown>)[pluginDirName];
  // ~/.claude/settings.json is user-global and contains state we did not author
  // (theme, hooks, other plugins). A non-atomic writeFile mid-power-loss could
  // truncate the file to zero bytes. Use a temp file + rename so the original
  // stays intact until the new content is fully durable.
  await writeJsonAtomic(userSettingsFile, settings);
}

async function writeJsonAtomic(filePath: string, data: unknown): Promise<void> {
  const tmp = `${filePath}.tmp`;
  await writeFile(tmp, JSON.stringify(data, null, 2) + '\n', 'utf-8');
  await rename(tmp, filePath);
}
