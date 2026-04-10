import { readFile, writeFile } from 'fs/promises';
import { join } from 'path';

export async function ensureGitignore(projectDir: string, entries: string[]): Promise<void> {
  const gitignorePath = join(projectDir, '.gitignore');
  let content = '';

  try {
    content = await readFile(gitignorePath, 'utf-8');
  } catch {
    // File doesn't exist — start empty
  }

  const existingLines = new Set(content.split('\n').map(l => l.trim()));
  const toAdd = entries.filter(e => !existingLines.has(e));

  if (toAdd.length === 0) return;

  const suffix = content.endsWith('\n') || content === '' ? '' : '\n';
  const addition = toAdd.join('\n') + '\n';
  await writeFile(gitignorePath, content + suffix + addition, 'utf-8');
}
