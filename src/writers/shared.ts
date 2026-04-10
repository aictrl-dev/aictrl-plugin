import { writeFile, mkdir, rm } from 'fs/promises';
import { join, dirname, resolve, relative } from 'path';
import { existsSync } from 'fs';
import { SKILL_NAME_REGEX } from '../config.js';

export interface WritableSkill {
  name: string;
  markdown: string;
  files: Array<{ path: string; content: string }>;
}

export async function writeSkill(skillsDir: string, skill: WritableSkill): Promise<void> {
  if (!SKILL_NAME_REGEX.test(skill.name)) {
    throw new Error(`Invalid skill name: ${skill.name}`);
  }

  const skillDir = join(skillsDir, skill.name);
  await mkdir(skillDir, { recursive: true });
  await writeFile(join(skillDir, 'SKILL.md'), skill.markdown, 'utf-8');

  for (const file of skill.files) {
    if (file.path.includes('..')) {
      throw new Error(`Unsafe file path in skill ${skill.name}: ${file.path}`);
    }
    const filePath = resolve(skillDir, file.path);
    const rel = relative(skillDir, filePath);
    if (rel.startsWith('..')) {
      throw new Error(`Path traversal in skill ${skill.name}: ${file.path}`);
    }
    await mkdir(dirname(filePath), { recursive: true });
    await writeFile(filePath, file.content, 'utf-8');
  }
}

export async function clearSkillsDir(skillsDir: string): Promise<void> {
  if (!existsSync(skillsDir)) return;
  await rm(skillsDir, { recursive: true });
  await mkdir(skillsDir, { recursive: true });
}
