export type Editor = 'claude' | 'opencode' | 'cursor' | 'codex';

export const VALID_EDITORS: readonly Editor[] = ['claude', 'opencode', 'cursor', 'codex'];

export const EDITOR_CHOICES: ReadonlyArray<{ name: string; value: Editor }> = [
  { name: 'Claude Code', value: 'claude' },
  { name: 'OpenCode', value: 'opencode' },
  { name: 'Cursor', value: 'cursor' },
  { name: 'Codex', value: 'codex' },
];

export function parseEditors(editorsStr: string): Editor[] {
  const editors = editorsStr.split(',').map(e => e.trim());
  const invalid = editors.filter(e => !VALID_EDITORS.includes(e as Editor));
  if (invalid.length > 0) {
    throw new Error(
      `Unknown editor(s): ${invalid.join(', ')}. Valid options: ${VALID_EDITORS.join(', ')}`,
    );
  }
  return editors as Editor[];
}
