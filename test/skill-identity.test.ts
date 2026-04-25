import { describe, it, expect } from 'vitest';
import { parsePluginId, resolveSkillFolderName } from '../src/skill-identity.js';

describe('parsePluginId', () => {
  it('parses a qualified id into owner, repo, and bare name', () => {
    const result = parsePluginId('aictrl-dev__aictrl__kg-classify');
    expect(result).toEqual({ owner: 'aictrl-dev', repo: 'aictrl', bareName: 'kg-classify' });
  });

  it('returns null for a bare (unqualified) name', () => {
    expect(parsePluginId('kg-classify')).toBeNull();
    expect(parsePluginId('code-review')).toBeNull();
  });

  it('rejects a name with one __ separator (malformed)', () => {
    expect(() => parsePluginId('aictrl-dev__kg-classify')).toThrow(/malformed/i);
  });

  it('rejects a name with more than two __ separators (malformed)', () => {
    expect(() => parsePluginId('aictrl-dev__aictrl__kg__classify')).toThrow(/malformed/i);
  });

  it('rejects an empty owner segment', () => {
    expect(() => parsePluginId('__aictrl__kg-classify')).toThrow(/invalid/i);
  });

  it('rejects an empty repo segment', () => {
    expect(() => parsePluginId('aictrl-dev____kg-classify')).toThrow();
  });

  it('rejects an empty bare name segment', () => {
    expect(() => parsePluginId('aictrl-dev__aictrl__')).toThrow(/invalid/i);
  });

  it('rejects owner with invalid characters', () => {
    expect(() => parsePluginId('aictrl_dev__aictrl__kg-classify')).toThrow(/invalid/i);
  });
});

describe('resolveSkillFolderName', () => {
  it('returns the bare name for a qualified id', () => {
    expect(resolveSkillFolderName('aictrl-dev__aictrl__kg-classify')).toBe('kg-classify');
  });

  it('returns the name unchanged for a bare (unqualified) name', () => {
    expect(resolveSkillFolderName('code-review')).toBe('code-review');
    expect(resolveSkillFolderName('tdd')).toBe('tdd');
  });

  it('throws for a malformed qualified name', () => {
    expect(() => resolveSkillFolderName('aictrl-dev__kg-classify')).toThrow(/malformed/i);
  });
});
