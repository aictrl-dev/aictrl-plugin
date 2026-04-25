import { writeFile, mkdir, rm } from 'fs/promises';
import { join, dirname, resolve, relative } from 'path';
import { existsSync } from 'fs';
import { SKILL_NAME_REGEX } from '../config.js';
import { resolveSkillFolderName } from '../skill-identity.js';

export interface WritableSkill {
  name: string;
  markdown: string;
  files: Array<{ path: string; content: string }>;
}

export async function writeSkill(skillsDir: string, skill: WritableSkill): Promise<void> {
  // resolveSkillFolderName handles qualified IDs (owner__repo__name → bareName)
  // and throws for malformed qualified names; bare names pass through unchanged.
  const folderName = resolveSkillFolderName(skill.name);

  if (!SKILL_NAME_REGEX.test(folderName)) {
    throw new Error(`Invalid skill name: ${skill.name}`);
  }

  const skillDir = join(skillsDir, folderName);
  const skillMdPath = join(skillDir, 'SKILL.md');

  // Detect collisions: two qualified IDs sharing a bareName (e.g.
  // org1__repo1__kg-classify and org2__repo2__kg-classify) would silently
  // overwrite each other. Fail loud instead — caller can decide policy.
  if (existsSync(skillMdPath)) {
    throw new Error(
      `Skill folder collision at "${folderName}" — refusing to overwrite ${skillMdPath} (incoming skill: ${skill.name})`,
    );
  }

  await mkdir(skillDir, { recursive: true });
  await writeFile(skillMdPath, skill.markdown, 'utf-8');

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
