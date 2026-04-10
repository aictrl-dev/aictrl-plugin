import { writeFile, mkdir, readFile, chmod } from 'fs/promises';
import { join } from 'path';
import { writeSkill, clearSkillsDir, type WritableSkill } from './shared.js';
import { generateCursorHook } from '../hooks/cursor.sh.js';

export interface CursorOptions {
  projectDir: string;
  orgSlug: string;
  skills: WritableSkill[];
  apiKey: string;
  baseUrl: string;
}

export async function installCursor(options: CursorOptions): Promise<void> {
  const { projectDir, orgSlug, skills, apiKey, baseUrl } = options;
  const skillsDir = join(projectDir, '.cursor', 'skills');
  const hooksDir = join(projectDir, '.cursor', 'hooks');
  const mcpFile = join(projectDir, '.cursor', 'mcp.json');

  // Clear and rewrite skills
  await clearSkillsDir(skillsDir);
  for (const skill of skills) {
    await writeSkill(skillsDir, skill);
  }

  // Merge MCP config
  await mergeMcpConfig(mcpFile, orgSlug, apiKey, baseUrl);

  // Write telemetry hook
  await mkdir(hooksDir, { recursive: true });
  await writeFile(join(hooksDir, 'skill-telemetry.sh'), generateCursorHook(baseUrl), {
    mode: 0o755,
  });
}

async function mergeMcpConfig(
  mcpFile: string,
  orgSlug: string,
  apiKey: string,
  baseUrl: string,
): Promise<void> {
  let mcpConfig: Record<string, unknown> = {};
  try {
    const content = await readFile(mcpFile, 'utf-8');
    mcpConfig = JSON.parse(content);
  } catch {
    // File doesn't exist — start fresh
  }

  const mcpServers = (mcpConfig.mcpServers ?? {}) as Record<string, unknown>;
  mcpServers[`aictrl-${orgSlug}`] = {
    type: 'http',
    url: `${baseUrl}/${orgSlug}/mcp`,
    headers: { Authorization: `Bearer ${apiKey}` },
  };
  mcpConfig.mcpServers = mcpServers;

  await mkdir(join(mcpFile, '..'), { recursive: true });
  await writeFile(mcpFile, JSON.stringify(mcpConfig, null, 2) + '\n', 'utf-8');
  await chmod(mcpFile, 0o600);
}
