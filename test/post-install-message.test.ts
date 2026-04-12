import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { printPostInstallMessage } from '../src/post-install-message.js';

describe('printPostInstallMessage', () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  it('prints the legacy-cleanup reminder when claude editor is installed', () => {
    printPostInstallMessage('test-org', ['claude']);
    const output = consoleSpy.mock.calls.map(c => c.join(' ')).join('\n');
    expect(output).toContain('/plugin uninstall aictrl-test-org@aictrl-skills');
    expect(output).toContain('npx @aictrl/plugin again to update skills');
    expect(output).toContain('Done! Skills are ready to use');
  });

  it('does not print the legacy-cleanup reminder when only opencode is installed', () => {
    printPostInstallMessage('test-org', ['opencode']);
    const output = consoleSpy.mock.calls.map(c => c.join(' ')).join('\n');
    expect(output).not.toContain('/plugin uninstall');
    expect(output).not.toContain('marketplace add');
    expect(output).toContain('Done! Skills are ready to use');
    expect(output).toContain('npx @aictrl/plugin again to update skills');
  });

  it('does not print the legacy-cleanup reminder when only cursor is installed', () => {
    printPostInstallMessage('test-org', ['cursor']);
    const output = consoleSpy.mock.calls.map(c => c.join(' ')).join('\n');
    expect(output).not.toContain('/plugin uninstall');
    expect(output).toContain('Done! Skills are ready to use');
  });

  it('prints the cleanup reminder when claude and cursor are both installed', () => {
    printPostInstallMessage('multi-org', ['claude', 'cursor']);
    const output = consoleSpy.mock.calls.map(c => c.join(' ')).join('\n');
    expect(output).toContain('/plugin uninstall aictrl-multi-org@aictrl-skills');
    expect(output).toContain('Done! Skills are ready to use');
  });

  it('does not print the cleanup reminder when editors is empty', () => {
    printPostInstallMessage('empty-org', []);
    const output = consoleSpy.mock.calls.map(c => c.join(' ')).join('\n');
    expect(output).not.toContain('/plugin uninstall');
    expect(output).toContain('Done! Skills are ready to use');
  });
});
