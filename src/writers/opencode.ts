import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { writeSkill, clearSkillsDir, type WritableSkill } from './shared.js';
import { generateOpenCodeHook } from '../hooks/opencode.sh.js';

export interface OpenCodeOptions {
  projectDir: string;
  skills: WritableSkill[];
  baseUrl: string;
}

export async function installOpenCode(options: OpenCodeOptions): Promise<void> {
  const { projectDir, skills, baseUrl } = options;
  const skillsDir = join(projectDir, '.opencode', 'skills');
  const hooksDir = join(projectDir, '.opencode', 'hooks');

  // Clear and rewrite skills
  await clearSkillsDir(skillsDir);
  for (const skill of skills) {
    await writeSkill(skillsDir, skill);
  }

  // Write telemetry hook
  await mkdir(hooksDir, { recursive: true });
  await writeFile(join(hooksDir, 'skill-telemetry.sh'), generateOpenCodeHook(baseUrl), {
    mode: 0o755,
  });
}
