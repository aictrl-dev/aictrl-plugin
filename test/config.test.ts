import { describe, it, expect } from 'vitest';
import { DEFAULT_BASE_URL, SKILL_NAME_REGEX, FETCH_BATCH_SIZE } from '../src/config.js';

describe('config', () => {
  it('has a valid default base URL', () => {
    expect(DEFAULT_BASE_URL).toBe('https://aictrl.dev');
  });

  it('skill name regex matches valid names', () => {
    expect(SKILL_NAME_REGEX.test('code-review')).toBe(true);
    expect(SKILL_NAME_REGEX.test('a1')).toBe(true);
    expect(SKILL_NAME_REGEX.test('tdd')).toBe(true);
  });

  it('skill name regex rejects invalid names', () => {
    expect(SKILL_NAME_REGEX.test('-starts-with-dash')).toBe(false);
    expect(SKILL_NAME_REGEX.test('ends-with-dash-')).toBe(false);
    expect(SKILL_NAME_REGEX.test('a')).toBe(false);
    expect(SKILL_NAME_REGEX.test('HAS-CAPS')).toBe(false);
  });

  it('fetch batch size is reasonable', () => {
    expect(FETCH_BATCH_SIZE).toBe(10);
  });
});
