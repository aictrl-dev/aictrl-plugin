import { writeFile, mkdir, readFile, chmod } from 'fs/promises';
import { join } from 'path';
import { writeSkill, clearSkillsDir, type WritableSkill } from './shared.js';
import { generateClaudeHook } from '../hooks/claude.sh.js';

export interface ClaudePluginOptions {
  orgSlug: string;
  skills: WritableSkill[];
  apiKey: string;
  baseUrl: string;
  pluginsCache: string;
  settingsFile: string;
}

export async function installClaudePlugin(options: ClaudePluginOptions): Promise<void> {
  const { orgSlug, skills, apiKey, baseUrl, pluginsCache, settingsFile } = options;
  const pluginId = `aictrl-${orgSlug}`;
  const pluginDirName = `${pluginId}@aictrl`;
  const pluginDir = join(pluginsCache, pluginDirName);
  const skillsDir = join(pluginDir, 'skills');

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
        version: '1.0.0',
        author: { name: 'aictrl.dev' },
        homepage: 'https://aictrl.dev',
        mcpServers: './.mcp.json',
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

  // Register plugin in settings.json
  await mergeSettings(settingsFile, pluginDirName);
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
