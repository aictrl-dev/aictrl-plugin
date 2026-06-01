import type { Editor } from './editors.js';

export type { Editor };

export function printPostInstallMessage(orgSlug: string, editors: Editor[]): void {
  console.log('  Done! Skills are ready to use.');

  if (editors.includes('claude')) {
    console.log('');
    console.log('  If you previously installed aictrl via /plugin marketplace add,');
    console.log('  run this in Claude Code to clean up the legacy plugin:');
    console.log('');
    console.log(`    /plugin uninstall aictrl-${orgSlug}@aictrl-skills`);
    console.log('');
  }

  if (editors.includes('codex')) {
    console.log('');
    console.log('  Codex MCP auth uses AICTRL_API_KEY from your environment.');
    console.log('  Codex skill telemetry is not installed yet because Codex does not');
    console.log('  expose a stable skill-invocation hook surface.');
    console.log('');
  }

  console.log('  Run npx @aictrl/plugin again to update skills.\n');
}
