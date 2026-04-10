import { writeFile, mkdir, rm } from 'fs/promises';
import { join, dirname } from 'path';
import { existsSync } from 'fs';

export interface WritableSkill {
  name: string;
  markdown: string;
  files: Array<{ path: string; content: string }>;
}

export async function writeSkill(skillsDir: string, skill: WritableSkill): Promise<void> {
  const skillDir = join(skillsDir, skill.name);
  await mkdir(skillDir, { recursive: true });
  await writeFile(join(skillDir, 'SKILL.md'), skill.markdown, 'utf-8');

  for (const file of skill.files) {
    const filePath = join(skillDir, file.path);
    await mkdir(dirname(filePath), { recursive: true });
    await writeFile(filePath, file.content, 'utf-8');
  }
}

export async function clearSkillsDir(skillsDir: string): Promise<void> {
  if (!existsSync(skillsDir)) return;
  await rm(skillsDir, { recursive: true });
  await mkdir(skillsDir, { recursive: true });
}
