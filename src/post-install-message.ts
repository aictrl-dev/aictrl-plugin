export type Editor = 'claude' | 'opencode' | 'cursor';

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

  console.log('  Run npx @aictrl/plugin again to update skills.\n');
}
