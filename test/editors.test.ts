import { describe, expect, it } from 'vitest';
import { EDITOR_CHOICES, parseEditors, VALID_EDITORS } from '../src/editors.js';

describe('editors', () => {
  it('parses codex in non-interactive editor lists', () => {
    expect(parseEditors('codex')).toEqual(['codex']);
    expect(parseEditors('claude,codex')).toEqual(['claude', 'codex']);
  });

  it('reports codex as a valid option when validation fails', () => {
    expect(() => parseEditors('gemini')).toThrow(
      'Unknown editor(s): gemini. Valid options: claude, opencode, cursor, codex',
    );
  });

  it('includes Codex in the interactive selector choices', () => {
    expect(VALID_EDITORS).toContain('codex');
    expect(EDITOR_CHOICES).toContainEqual({ name: 'Codex', value: 'codex' });
  });
});
