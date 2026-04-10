import { parseArgs } from 'util';
import { join } from 'path';
import { input, checkbox, password } from '@inquirer/prompts';
import {
  DEFAULT_BASE_URL,
  CREDENTIALS_FILE,
  PROJECT_CONFIG_FILE,
  CLAUDE_PLUGINS_CACHE,
  CLAUDE_SETTINGS_FILE,
  FETCH_BATCH_SIZE,
} from './config.js';
import { readCredentials, writeOrgCredential, readProjectConfig, writeProjectConfig } from './credentials.js';
import { verifyApiKey } from './verify.js';
import { fetchMarketplace, fetchSkillContent, type MarketplaceSkill } from './fetch-skills.js';
import { installClaudePlugin } from './writers/claude.js';
import { installOpenCode } from './writers/opencode.js';
import { installCursor } from './writers/cursor.js';
import { ensureGitignore } from './gitignore.js';
import type { WritableSkill } from './writers/shared.js';

type Editor = 'claude' | 'opencode' | 'cursor';

interface CliOptions {
  org?: string;
  apiKey?: string;
  editors?: string;
  nonInteractive: boolean;
  baseUrl: string;
}

function parseCliArgs(): CliOptions {
  const { values } = parseArgs({
    options: {
      org: { type: 'string' },
      'api-key': { type: 'string' },
      editors: { type: 'string' },
      'non-interactive': { type: 'boolean', default: false },
      'base-url': { type: 'string', default: DEFAULT_BASE_URL },
    },
    strict: false,
  });

  return {
    org: values.org as string | undefined,
    apiKey: values['api-key'] as string | undefined,
    editors: values.editors as string | undefined,
    nonInteractive: (values['non-interactive'] as boolean) ?? false,
    baseUrl: (values['base-url'] as string) ?? DEFAULT_BASE_URL,
  };
}

function parseEditors(editorsStr: string): Editor[] {
  return editorsStr.split(',').map(e => e.trim()) as Editor[];
}

async function resolveOrg(options: CliOptions): Promise<string> {
  if (options.org) return options.org;
  if (options.nonInteractive) {
    throw new Error('--org is required in non-interactive mode');
  }
  return input({ message: 'Org slug:' });
}

async function resolveApiKey(
  options: CliOptions,
  orgSlug: string,
): Promise<string> {
  if (options.apiKey) return options.apiKey;

  const creds = await readCredentials(CREDENTIALS_FILE);
  const existing = creds.orgs[orgSlug]?.apiKey;
  if (existing) return existing;

  if (options.nonInteractive) {
    throw new Error('--api-key is required in non-interactive mode (no stored key found)');
  }

  return password({ message: 'API Key:', mask: '*' });
}

async function resolveEditors(options: CliOptions): Promise<Editor[]> {
  if (options.editors) return parseEditors(options.editors);
  if (options.nonInteractive) {
    throw new Error('--editors is required in non-interactive mode');
  }

  const selected = await checkbox({
    message: 'Select editors to configure:',
    choices: [
      { name: 'Claude Code', value: 'claude' as const },
      { name: 'OpenCode', value: 'opencode' as const },
      { name: 'Cursor', value: 'cursor' as const },
    ],
  });

  if (selected.length === 0) {
    throw new Error('No editors selected');
  }

  return selected;
}

async function fetchAllSkillContent(
  baseUrl: string,
  orgSlug: string,
  apiKey: string,
  marketplace: MarketplaceSkill[],
): Promise<WritableSkill[]> {
  const skills: WritableSkill[] = [];

  for (let i = 0; i < marketplace.length; i += FETCH_BATCH_SIZE) {
    const batch = marketplace.slice(i, i + FETCH_BATCH_SIZE);
    const results = await Promise.all(
      batch.map(async (skill) => {
        try {
          const content = await fetchSkillContent(baseUrl, orgSlug, apiKey, skill);
          return { name: skill.name, markdown: content.markdown, files: content.files };
        } catch (err) {
          console.warn(`  ⚠ Skipped ${skill.name}: ${(err as Error).message}`);
          return null;
        }
      }),
    );
    skills.push(...results.filter((s): s is WritableSkill => s !== null));
  }

  return skills;
}

async function main(): Promise<void> {
  console.log('\n  aictrl.dev — Developer Setup\n');

  const options = parseCliArgs();

  // 1. Resolve org and API key
  const orgSlug = await resolveOrg(options);
  const apiKey = await resolveApiKey(options, orgSlug);

  // 2. Verify API key
  process.stdout.write('  Verifying API key... ');
  try {
    await verifyApiKey(options.baseUrl, apiKey);
    console.log('✓');
  } catch (err) {
    console.log('✗');
    console.error(`\n  Error: ${(err as Error).message}`);
    process.exit(1);
  }

  // 3. Save credentials
  await writeOrgCredential(CREDENTIALS_FILE, orgSlug, apiKey);
  const projectDir = process.cwd();
  const existingConfig = await readProjectConfig(join(projectDir, PROJECT_CONFIG_FILE));
  if (existingConfig && existingConfig.orgSlug !== orgSlug) {
    console.log(`\n  ⚠ Replacing ${existingConfig.orgSlug} with ${orgSlug}`);
  }
  await writeProjectConfig(join(projectDir, PROJECT_CONFIG_FILE), orgSlug);

  // 4. Select editors
  const editors = await resolveEditors(options);

  // 5. Fetch skills
  process.stdout.write(`  Fetching skills for ${orgSlug}... `);
  const marketplace = await fetchMarketplace(options.baseUrl, orgSlug, apiKey);
  console.log(`${marketplace.length} found`);

  const skills = await fetchAllSkillContent(options.baseUrl, orgSlug, apiKey, marketplace);
  console.log(`  Fetched content for ${skills.length} skills\n`);

  // 6. Install per editor
  const gitignoreEntries: string[] = [];

  if (editors.includes('claude')) {
    console.log('  Claude Code:');
    await installClaudePlugin({
      orgSlug,
      skills,
      apiKey,
      baseUrl: options.baseUrl,
      pluginsCache: CLAUDE_PLUGINS_CACHE,
      settingsFile: CLAUDE_SETTINGS_FILE,
    });
    console.log(`    ✓ Installed plugin aictrl-${orgSlug} (${skills.length} skills)`);
    console.log(`    ✓ Configured MCP server aictrl-${orgSlug}`);
    console.log('    ✓ Installed telemetry hook\n');
  }

  if (editors.includes('opencode')) {
    console.log('  OpenCode:');
    await installOpenCode({
      projectDir,
      skills,
      baseUrl: options.baseUrl,
    });
    console.log(`    ✓ Wrote ${skills.length} skills to .opencode/skills/`);
    console.log('    ✓ Installed telemetry hook');
    console.log(`\n    ℹ Add MCP server to opencode.json:`);
    console.log(`      "mcp": { "aictrl-${orgSlug}": { "type": "remote", "url": "${options.baseUrl}/${orgSlug}/mcp" } }\n`);
  }

  if (editors.includes('cursor')) {
    console.log('  Cursor:');
    await installCursor({
      projectDir,
      orgSlug,
      skills,
      apiKey,
      baseUrl: options.baseUrl,
    });
    console.log(`    ✓ Wrote ${skills.length} skills to .cursor/skills/`);
    console.log(`    ✓ Configured MCP server in .cursor/mcp.json`);
    console.log('    ✓ Installed telemetry hook\n');
    gitignoreEntries.push('.cursor/mcp.json');
  }

  // 7. Update .gitignore
  if (gitignoreEntries.length > 0) {
    await ensureGitignore(projectDir, gitignoreEntries);
  }

  console.log('  Done! Skills are ready to use.');
  console.log('  Run npx @aictrl/setup again to update skills.\n');
}

main().catch((err) => {
  console.error(`\n  Error: ${(err as Error).message}\n`);
  process.exit(1);
});
