# @aictrl/setup npx Installer — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an npm package (`@aictrl/setup`) that configures a developer's project with aictrl skills, telemetry hooks, and MCP integration across Claude Code, OpenCode, and Cursor via a single `npx` command.

**Architecture:** Pure file writer — fetches skill metadata and content from the existing aictrl marketplace API, writes editor-specific files. Credentials stored globally in `~/.aictrl/credentials.json`, per-project org pointer in `.aictrl.json`. Claude Code installs as a proper plugin; OpenCode and Cursor write standalone skills.

**Tech Stack:** TypeScript, Node.js (ESM), `inquirer` for prompts, native `fetch`/`fs`/`crypto`, `vitest` for tests, compiled to JS via `tsc`.

---

## File Structure

```
@aictrl/setup/
├── package.json                     # Package config, bin entry, scripts
├── tsconfig.json                    # TypeScript config (ES2022, NodeNext)
├── vitest.config.ts                 # Test config
├── .gitignore                       # node_modules, dist
├── bin/
│   └── setup.js                     # npx entry point — imports dist/cli.js
├── src/
│   ├── cli.ts                       # Main flow: parse args, prompt, orchestrate
│   ├── config.ts                    # Constants: base URL, paths, defaults
│   ├── credentials.ts               # Read/write ~/.aictrl/credentials.json + .aictrl.json
│   ├── verify.ts                    # GET /skill-usage/verify
│   ├── fetch-skills.ts              # Fetch marketplace.json + skill content
│   ├── gitignore.ts                 # Append entries to .gitignore
│   ├── writers/
│   │   ├── shared.ts                # Write SKILL.md + supporting files to any dir
│   │   ├── claude.ts                # Plugin install to ~/.claude/plugins/cache/
│   │   ├── opencode.ts              # Write to .opencode/skills/ + hooks
│   │   └── cursor.ts                # Write to .cursor/skills/ + mcp.json + hooks
│   └── hooks/
│       ├── resolve-credentials.sh.ts  # Shared credential resolver snippet
│       ├── claude.sh.ts             # Claude Code PostToolUse hook template
│       ├── opencode.sh.ts           # OpenCode skill tool hook template
│       └── cursor.sh.ts             # Cursor beforeReadFile hook template
├── test/
│   ├── config.test.ts
│   ├── credentials.test.ts
│   ├── verify.test.ts
│   ├── fetch-skills.test.ts
│   ├── gitignore.test.ts
│   ├── writers/
│   │   ├── shared.test.ts
│   │   ├── claude.test.ts
│   │   ├── opencode.test.ts
│   │   └── cursor.test.ts
│   └── fixtures/
│       ├── marketplace.json
│       └── skill-review.md
└── docs/
    └── superpowers/
        ├── specs/
        │   └── 2026-04-10-aictrl-setup-npx-installer-design.md
        └── plans/
            └── 2026-04-10-aictrl-setup-npx-installer.md
```

**Responsibilities:**

| File | Responsibility |
|------|---------------|
| `config.ts` | Export constants: `BASE_URL`, `CREDENTIALS_PATH`, `PROJECT_CONFIG_FILE`, editor skill paths |
| `credentials.ts` | `readCredentials()`, `writeCredentials()`, `readProjectConfig()`, `writeProjectConfig()` |
| `verify.ts` | `verifyApiKey(baseUrl, apiKey)` → `{ verified, orgId }` or throws |
| `fetch-skills.ts` | `fetchMarketplace(baseUrl, orgSlug, apiKey)` → skill list; `fetchSkillContent(...)` → SKILL.md + files |
| `writers/shared.ts` | `writeSkill(dir, skill)` → writes SKILL.md + supporting files to a target directory |
| `writers/claude.ts` | `installClaudePlugin(orgSlug, skills, apiKey, baseUrl)` → plugin dir + settings merge |
| `writers/opencode.ts` | `installOpenCode(projectDir, orgSlug, skills)` → .opencode/skills/ + hooks |
| `writers/cursor.ts` | `installCursor(projectDir, orgSlug, skills, apiKey, baseUrl)` → .cursor/skills/ + mcp.json + hooks |
| `hooks/*.sh.ts` | Each exports a `generateHookScript(baseUrl)` → string of the shell script content |
| `gitignore.ts` | `ensureGitignore(projectDir, entries)` → append missing entries |
| `cli.ts` | Parse `--org`, `--api-key`, `--editors`, `--non-interactive`; prompt with `inquirer`; call the above |

---

### Task 1: Project Scaffolding

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `vitest.config.ts`
- Create: `.gitignore`
- Create: `bin/setup.js`
- Create: `src/config.ts`

- [ ] **Step 1: Create package.json**

```json
{
  "name": "@aictrl/setup",
  "version": "0.1.0",
  "description": "Set up aictrl skills, telemetry, and MCP for Claude Code, OpenCode, and Cursor",
  "type": "module",
  "bin": {
    "aictrl-setup": "bin/setup.js"
  },
  "scripts": {
    "build": "tsc",
    "test": "vitest run",
    "test:watch": "vitest",
    "prepublishOnly": "npm run build"
  },
  "files": [
    "dist",
    "bin"
  ],
  "keywords": ["aictrl", "claude-code", "opencode", "cursor", "skills", "mcp", "setup"],
  "author": "aictrl.dev",
  "license": "MIT",
  "engines": {
    "node": ">=18.0.0"
  },
  "dependencies": {
    "@inquirer/prompts": "^7.0.0"
  },
  "devDependencies": {
    "@types/node": "^22.0.0",
    "typescript": "^5.7.0",
    "vitest": "^3.0.0"
  }
}
```

- [ ] **Step 2: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "esModuleInterop": true,
    "strict": true,
    "skipLibCheck": true,
    "outDir": "./dist",
    "rootDir": "./src",
    "declaration": true,
    "resolveJsonModule": true,
    "forceConsistentCasingInFileNames": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "test"]
}
```

- [ ] **Step 3: Create vitest.config.ts**

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['test/**/*.test.ts'],
  },
});
```

- [ ] **Step 4: Create .gitignore**

```
node_modules/
dist/
*.tgz
```

- [ ] **Step 5: Create bin/setup.js**

```javascript
#!/usr/bin/env node
import('../dist/cli.js');
```

- [ ] **Step 6: Create src/config.ts**

```typescript
import { homedir } from 'os';
import { join } from 'path';

export const DEFAULT_BASE_URL = 'https://aictrl.dev';

export const CREDENTIALS_DIR = join(homedir(), '.aictrl');
export const CREDENTIALS_FILE = join(CREDENTIALS_DIR, 'credentials.json');

export const PROJECT_CONFIG_FILE = '.aictrl.json';

export const CLAUDE_PLUGINS_CACHE = join(homedir(), '.claude', 'plugins', 'cache');
export const CLAUDE_SETTINGS_FILE = join(homedir(), '.claude', 'settings.json');

export const OPENCODE_SKILLS_DIR = '.opencode/skills';
export const OPENCODE_HOOKS_DIR = '.opencode/hooks';

export const CURSOR_SKILLS_DIR = '.cursor/skills';
export const CURSOR_HOOKS_DIR = '.cursor/hooks';
export const CURSOR_MCP_FILE = '.cursor/mcp.json';

export const SKILL_NAME_REGEX = /^[a-z0-9][a-z0-9-]{0,98}[a-z0-9]$/;

export const TELEMETRY_TIMEOUT_CONNECT = 3000;
export const TELEMETRY_TIMEOUT_TOTAL = 5000;
export const FETCH_BATCH_SIZE = 10;
```

- [ ] **Step 7: Install dependencies and verify build**

Run: `npm install && npm run build`
Expected: Clean install, `dist/config.js` produced with no errors.

- [ ] **Step 8: Create a smoke test for config**

Create `test/config.test.ts`:

```typescript
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
```

- [ ] **Step 9: Run tests**

Run: `npm test`
Expected: All 4 tests pass.

- [ ] **Step 10: Commit**

```bash
git add package.json tsconfig.json vitest.config.ts .gitignore bin/setup.js src/config.ts test/config.test.ts
git commit -m "feat: scaffold project with config constants and build setup"
```

---

### Task 2: Credential Management

**Files:**
- Create: `src/credentials.ts`
- Create: `test/credentials.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `test/credentials.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, readFile, mkdir, writeFile, stat } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import {
  readCredentials,
  writeOrgCredential,
  readProjectConfig,
  writeProjectConfig,
} from '../src/credentials.js';

describe('credentials', () => {
  let tempDir: string;
  let credentialsFile: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'aictrl-test-'));
    credentialsFile = join(tempDir, 'credentials.json');
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true });
  });

  describe('readCredentials', () => {
    it('returns empty orgs when file does not exist', async () => {
      const creds = await readCredentials(credentialsFile);
      expect(creds).toEqual({ orgs: {} });
    });

    it('reads existing credentials', async () => {
      await writeFile(credentialsFile, JSON.stringify({
        orgs: { talentrix: { apiKey: 'sk_live_xxx' } }
      }));
      const creds = await readCredentials(credentialsFile);
      expect(creds.orgs.talentrix.apiKey).toBe('sk_live_xxx');
    });
  });

  describe('writeOrgCredential', () => {
    it('creates file and directory if they do not exist', async () => {
      const nestedFile = join(tempDir, 'nested', 'credentials.json');
      await writeOrgCredential(nestedFile, 'myorg', 'sk_live_abc');
      const creds = JSON.parse(await readFile(nestedFile, 'utf-8'));
      expect(creds.orgs.myorg.apiKey).toBe('sk_live_abc');
    });

    it('preserves existing orgs when adding a new one', async () => {
      await writeFile(credentialsFile, JSON.stringify({
        orgs: { org1: { apiKey: 'key1' } }
      }));
      await writeOrgCredential(credentialsFile, 'org2', 'key2');
      const creds = JSON.parse(await readFile(credentialsFile, 'utf-8'));
      expect(creds.orgs.org1.apiKey).toBe('key1');
      expect(creds.orgs.org2.apiKey).toBe('key2');
    });

    it('overwrites existing org key', async () => {
      await writeFile(credentialsFile, JSON.stringify({
        orgs: { myorg: { apiKey: 'old-key' } }
      }));
      await writeOrgCredential(credentialsFile, 'myorg', 'new-key');
      const creds = JSON.parse(await readFile(credentialsFile, 'utf-8'));
      expect(creds.orgs.myorg.apiKey).toBe('new-key');
    });

    it('sets file permissions to 0600', async () => {
      await writeOrgCredential(credentialsFile, 'myorg', 'sk_live_abc');
      const stats = await stat(credentialsFile);
      expect(stats.mode & 0o777).toBe(0o600);
    });
  });

  describe('readProjectConfig', () => {
    it('returns null when file does not exist', async () => {
      const config = await readProjectConfig(join(tempDir, '.aictrl.json'));
      expect(config).toBeNull();
    });

    it('reads existing project config', async () => {
      const configPath = join(tempDir, '.aictrl.json');
      await writeFile(configPath, JSON.stringify({ orgSlug: 'talentrix' }));
      const config = await readProjectConfig(configPath);
      expect(config?.orgSlug).toBe('talentrix');
    });
  });

  describe('writeProjectConfig', () => {
    it('writes org slug to file', async () => {
      const configPath = join(tempDir, '.aictrl.json');
      await writeProjectConfig(configPath, 'talentrix');
      const config = JSON.parse(await readFile(configPath, 'utf-8'));
      expect(config.orgSlug).toBe('talentrix');
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — `credentials.js` does not exist.

- [ ] **Step 3: Implement credentials.ts**

Create `src/credentials.ts`:

```typescript
import { readFile, writeFile, mkdir, chmod } from 'fs/promises';
import { dirname } from 'path';

export interface Credentials {
  orgs: Record<string, { apiKey: string }>;
}

export interface ProjectConfig {
  orgSlug: string;
}

export async function readCredentials(filePath: string): Promise<Credentials> {
  try {
    const content = await readFile(filePath, 'utf-8');
    return JSON.parse(content) as Credentials;
  } catch {
    return { orgs: {} };
  }
}

export async function writeOrgCredential(
  filePath: string,
  orgSlug: string,
  apiKey: string,
): Promise<void> {
  await mkdir(dirname(filePath), { recursive: true });
  const existing = await readCredentials(filePath);
  existing.orgs[orgSlug] = { apiKey };
  await writeFile(filePath, JSON.stringify(existing, null, 2) + '\n', 'utf-8');
  await chmod(filePath, 0o600);
}

export async function readProjectConfig(filePath: string): Promise<ProjectConfig | null> {
  try {
    const content = await readFile(filePath, 'utf-8');
    return JSON.parse(content) as ProjectConfig;
  } catch {
    return null;
  }
}

export async function writeProjectConfig(filePath: string, orgSlug: string): Promise<void> {
  await writeFile(filePath, JSON.stringify({ orgSlug }, null, 2) + '\n', 'utf-8');
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: All credentials tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/credentials.ts test/credentials.test.ts
git commit -m "feat: add credential storage (global + per-project)"
```

---

### Task 3: API Key Verification

**Files:**
- Create: `src/verify.ts`
- Create: `test/verify.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `test/verify.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { verifyApiKey } from '../src/verify.js';

describe('verifyApiKey', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('returns orgId on successful verification', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ verified: true, orgId: 'org-123' }),
    });

    const result = await verifyApiKey('https://aictrl.dev', 'sk_live_xxx');
    expect(result.verified).toBe(true);
    expect(result.orgId).toBe('org-123');
    expect(globalThis.fetch).toHaveBeenCalledWith(
      'https://aictrl.dev/api/telemetry/skill-usage/verify',
      expect.objectContaining({
        headers: expect.objectContaining({ 'X-API-Key': 'sk_live_xxx' }),
      }),
    );
  });

  it('throws on 401 (invalid key)', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: () => Promise.resolve({ error: 'Unauthorized' }),
    });

    await expect(verifyApiKey('https://aictrl.dev', 'bad-key'))
      .rejects.toThrow('Invalid API key');
  });

  it('throws on 403 (key not org-scoped)', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      json: () => Promise.resolve({ error: 'API_KEY_NOT_ORG_SCOPED' }),
    });

    await expect(verifyApiKey('https://aictrl.dev', 'sk_live_noscope'))
      .rejects.toThrow('API key is not scoped to an organization');
  });

  it('throws on network error', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('fetch failed'));

    await expect(verifyApiKey('https://aictrl.dev', 'sk_live_xxx'))
      .rejects.toThrow('fetch failed');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — `verify.js` does not exist.

- [ ] **Step 3: Implement verify.ts**

Create `src/verify.ts`:

```typescript
export interface VerifyResult {
  verified: boolean;
  orgId: string;
}

export async function verifyApiKey(baseUrl: string, apiKey: string): Promise<VerifyResult> {
  const url = `${baseUrl}/api/telemetry/skill-usage/verify`;

  const response = await fetch(url, {
    method: 'GET',
    headers: { 'X-API-Key': apiKey },
  });

  if (response.status === 401) {
    throw new Error('Invalid API key');
  }

  if (response.status === 403) {
    throw new Error('API key is not scoped to an organization');
  }

  if (!response.ok) {
    throw new Error(`Verification failed with status ${response.status}`);
  }

  const data = await response.json() as VerifyResult;
  return data;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: All verify tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/verify.ts test/verify.test.ts
git commit -m "feat: add API key verification against /skill-usage/verify"
```

---

### Task 4: Marketplace Skill Fetching

**Files:**
- Create: `src/fetch-skills.ts`
- Create: `test/fetch-skills.test.ts`
- Create: `test/fixtures/marketplace.json`
- Create: `test/fixtures/skill-review.md`

- [ ] **Step 1: Create test fixtures**

Create `test/fixtures/marketplace.json`:

```json
{
  "name": "talentrix-skills",
  "owner": { "name": "Talentrix Inc" },
  "metadata": {
    "description": "Skills marketplace for Talentrix Inc",
    "version": "1.0.0",
    "pluginRoot": "plugins"
  },
  "plugins": [
    {
      "name": "code-review",
      "source": "./plugins/code-review",
      "description": "Review code changes",
      "version": "1.0.0",
      "tags": ["code", "review"]
    },
    {
      "name": "tdd",
      "source": "./plugins/tdd",
      "description": "Test-driven development guide",
      "version": "2.0.0",
      "tags": ["testing"]
    },
    {
      "name": "aictrl-talentrix",
      "source": "./plugins/aictrl-talentrix",
      "description": "AIctrl session control for Talentrix Inc",
      "version": "1.0.0",
      "tags": ["mcp", "aictrl"]
    }
  ]
}
```

Create `test/fixtures/skill-review.md`:

```markdown
---
name: code-review
description: "Review code changes"
allowedTools:
  - Read
  - Bash
tags:
  - code
  - review
version: "1.0.0"
---

Review the code changes and provide feedback.
```

- [ ] **Step 2: Write the failing tests**

Create `test/fetch-skills.test.ts`:

```typescript
import { describe, it, expect, vi, afterEach } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { fetchMarketplace, fetchSkillContent, type MarketplaceSkill } from '../src/fetch-skills.js';

const fixturesDir = join(import.meta.dirname, 'fixtures');
const marketplaceFixture = JSON.parse(readFileSync(join(fixturesDir, 'marketplace.json'), 'utf-8'));
const skillFixture = readFileSync(join(fixturesDir, 'skill-review.md'), 'utf-8');

describe('fetchMarketplace', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('fetches and returns skill list, filtering out MCP connector', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(marketplaceFixture),
    });

    const skills = await fetchMarketplace('https://aictrl.dev', 'talentrix', 'sk_live_xxx');
    expect(skills).toHaveLength(2);
    expect(skills.map(s => s.name)).toEqual(['code-review', 'tdd']);
    expect(skills.find(s => s.name === 'aictrl-talentrix')).toBeUndefined();
  });

  it('constructs correct API URL with org slug and api key', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(marketplaceFixture),
    });

    await fetchMarketplace('https://aictrl.dev', 'talentrix', 'sk_live_xxx');
    expect(globalThis.fetch).toHaveBeenCalledWith(
      'https://aictrl.dev/talentrix/sk_live_xxx/marketplace.json',
    );
  });

  it('throws on 401', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: () => Promise.resolve({ error: 'Unauthorized' }),
    });

    await expect(fetchMarketplace('https://aictrl.dev', 'talentrix', 'bad'))
      .rejects.toThrow('Invalid API key or org slug');
  });
});

describe('fetchSkillContent', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('fetches SKILL.md content for a simple skill', async () => {
    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.endsWith('/SKILL.md')) {
        return Promise.resolve({ ok: true, text: () => Promise.resolve(skillFixture) });
      }
      if (url.endsWith('/plugin.json')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ name: 'code-review' }) });
      }
      return Promise.resolve({ ok: false, status: 404 });
    });

    const skill: MarketplaceSkill = {
      name: 'code-review',
      description: 'Review code changes',
      version: '1.0.0',
      tags: ['code', 'review'],
    };

    const content = await fetchSkillContent('https://aictrl.dev', 'talentrix', 'sk_live_xxx', skill);
    expect(content.markdown).toContain('Review the code changes');
    expect(content.files).toEqual([]);
  });

  it('fetches supporting files for directory-based skills', async () => {
    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.endsWith('/SKILL.md')) {
        return Promise.resolve({ ok: true, text: () => Promise.resolve(skillFixture) });
      }
      if (url.endsWith('/plugin.json')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            name: 'code-review',
            files: [
              { path: 'SKILL.md' },
              { path: 'references/checklist.md' },
            ],
          }),
        });
      }
      if (url.endsWith('/references/checklist.md')) {
        return Promise.resolve({ ok: true, text: () => Promise.resolve('# Checklist\n- Item 1') });
      }
      return Promise.resolve({ ok: false, status: 404 });
    });

    const skill: MarketplaceSkill = {
      name: 'code-review',
      description: 'Review code changes',
      version: '1.0.0',
      tags: ['code', 'review'],
    };

    const content = await fetchSkillContent('https://aictrl.dev', 'talentrix', 'sk_live_xxx', skill);
    expect(content.files).toHaveLength(1);
    expect(content.files[0].path).toBe('references/checklist.md');
    expect(content.files[0].content).toContain('Checklist');
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — `fetch-skills.js` does not exist.

- [ ] **Step 4: Implement fetch-skills.ts**

Create `src/fetch-skills.ts`:

```typescript
export interface MarketplaceSkill {
  name: string;
  description: string;
  version: string;
  tags: string[];
}

export interface SkillFile {
  path: string;
  content: string;
}

export interface SkillContent {
  markdown: string;
  files: SkillFile[];
}

interface MarketplaceResponse {
  name: string;
  plugins: Array<{
    name: string;
    description: string;
    version: string;
    tags: string[];
  }>;
}

interface PluginJson {
  name: string;
  files?: Array<{ path: string }>;
}

export async function fetchMarketplace(
  baseUrl: string,
  orgSlug: string,
  apiKey: string,
): Promise<MarketplaceSkill[]> {
  const url = `${baseUrl}/${orgSlug}/${apiKey}/marketplace.json`;
  const response = await fetch(url);

  if (response.status === 401) {
    throw new Error('Invalid API key or org slug');
  }

  if (!response.ok) {
    throw new Error(`Failed to fetch marketplace (status ${response.status})`);
  }

  const data = await response.json() as MarketplaceResponse;

  const mcpPrefix = `aictrl-`;
  return data.plugins
    .filter(p => !(p.tags?.includes('mcp') && p.name.startsWith(mcpPrefix)))
    .map(p => ({
      name: p.name,
      description: p.description,
      version: p.version || '1.0.0',
      tags: p.tags || [],
    }));
}

export async function fetchSkillContent(
  baseUrl: string,
  orgSlug: string,
  apiKey: string,
  skill: MarketplaceSkill,
): Promise<SkillContent> {
  const pluginBase = `${baseUrl}/${orgSlug}/${apiKey}/plugins/${skill.name}`;

  // Fetch SKILL.md
  const mdResponse = await fetch(`${pluginBase}/SKILL.md`);
  if (!mdResponse.ok) {
    throw new Error(`Failed to fetch SKILL.md for ${skill.name} (status ${mdResponse.status})`);
  }
  const markdown = await mdResponse.text();

  // Fetch plugin.json to check for supporting files
  const pjResponse = await fetch(`${pluginBase}/.claude-plugin/plugin.json`);
  if (!pjResponse.ok) {
    return { markdown, files: [] };
  }

  const pluginJson = await pjResponse.json() as PluginJson;
  if (!pluginJson.files || pluginJson.files.length === 0) {
    return { markdown, files: [] };
  }

  // Fetch supporting files (skip SKILL.md itself)
  const supportingFiles = pluginJson.files.filter(f => f.path !== 'SKILL.md');
  const files: SkillFile[] = [];

  for (const file of supportingFiles) {
    const fileResponse = await fetch(`${pluginBase}/${file.path}`);
    if (fileResponse.ok) {
      files.push({
        path: file.path,
        content: await fileResponse.text(),
      });
    }
  }

  return { markdown, files };
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test`
Expected: All fetch-skills tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/fetch-skills.ts test/fetch-skills.test.ts test/fixtures/marketplace.json test/fixtures/skill-review.md
git commit -m "feat: add marketplace skill fetching with directory skill support"
```

---

### Task 5: Shared Skill Writer

**Files:**
- Create: `src/writers/shared.ts`
- Create: `test/writers/shared.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `test/writers/shared.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, readFile } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { existsSync } from 'fs';
import { writeSkill, clearSkillsDir } from '../src/writers/shared.js';

describe('writeSkill', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'aictrl-test-'));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true });
  });

  it('writes SKILL.md to the correct directory', async () => {
    await writeSkill(tempDir, {
      name: 'code-review',
      markdown: '---\nname: code-review\n---\n\nReview code.',
      files: [],
    });

    const content = await readFile(join(tempDir, 'code-review', 'SKILL.md'), 'utf-8');
    expect(content).toContain('Review code.');
  });

  it('writes supporting files preserving directory structure', async () => {
    await writeSkill(tempDir, {
      name: 'tdd',
      markdown: '---\nname: tdd\n---\n\nTDD guide.',
      files: [
        { path: 'references/checklist.md', content: '# Checklist' },
        { path: 'scripts/validate.sh', content: '#!/bin/bash\necho ok' },
      ],
    });

    const checklist = await readFile(join(tempDir, 'tdd', 'references', 'checklist.md'), 'utf-8');
    expect(checklist).toBe('# Checklist');

    const script = await readFile(join(tempDir, 'tdd', 'scripts', 'validate.sh'), 'utf-8');
    expect(script).toContain('echo ok');
  });
});

describe('clearSkillsDir', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'aictrl-test-'));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true });
  });

  it('removes all contents of the skills directory', async () => {
    await writeSkill(tempDir, {
      name: 'old-skill',
      markdown: 'old content',
      files: [],
    });
    expect(existsSync(join(tempDir, 'old-skill'))).toBe(true);

    await clearSkillsDir(tempDir);
    expect(existsSync(join(tempDir, 'old-skill'))).toBe(false);
    expect(existsSync(tempDir)).toBe(true);
  });

  it('does nothing if directory does not exist', async () => {
    await clearSkillsDir(join(tempDir, 'nonexistent'));
    // Should not throw
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — `writers/shared.js` does not exist.

- [ ] **Step 3: Implement shared.ts**

Create `src/writers/shared.ts`:

```typescript
import { writeFile, mkdir, rm } from 'fs/promises';
import { join, dirname } from 'path';
import { existsSync } from 'fs';

export interface WritableSkill {
  name: string;
  markdown: string;
  files: Array<{ path: string; content: string }>;
}

export async function writeSkill(skillsDir: string, skill: WritableSkill): Promise<void> {
  const skillDir = join(skillsDir, skill.name);
  await mkdir(skillDir, { recursive: true });
  await writeFile(join(skillDir, 'SKILL.md'), skill.markdown, 'utf-8');

  for (const file of skill.files) {
    const filePath = join(skillDir, file.path);
    await mkdir(dirname(filePath), { recursive: true });
    await writeFile(filePath, file.content, 'utf-8');
  }
}

export async function clearSkillsDir(skillsDir: string): Promise<void> {
  if (!existsSync(skillsDir)) return;
  await rm(skillsDir, { recursive: true });
  await mkdir(skillsDir, { recursive: true });
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: All shared writer tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/writers/shared.ts test/writers/shared.test.ts
git commit -m "feat: add shared skill file writer with directory support"
```

---

### Task 6: Telemetry Hook Templates

**Files:**
- Create: `src/hooks/resolve-credentials.sh.ts`
- Create: `src/hooks/claude.sh.ts`
- Create: `src/hooks/opencode.sh.ts`
- Create: `src/hooks/cursor.sh.ts`

- [ ] **Step 1: Create the credential resolver snippet**

Create `src/hooks/resolve-credentials.sh.ts`:

```typescript
export function credentialResolverSnippet(baseUrl: string): string {
  return `# Resolve credentials from aictrl config files
AICTRL_PROJECT_CONFIG=".aictrl.json"
AICTRL_CREDENTIALS="$HOME/.aictrl/credentials.json"

# Find project root by walking up directories
find_project_root() {
  local dir="$PWD"
  while [ "$dir" != "/" ]; do
    if [ -f "$dir/$AICTRL_PROJECT_CONFIG" ]; then
      echo "$dir"
      return 0
    fi
    dir="$(dirname "$dir")"
  done
  return 1
}

PROJECT_ROOT=$(find_project_root) || exit 0
ORG_SLUG=$(jq -r '.orgSlug // empty' "$PROJECT_ROOT/$AICTRL_PROJECT_CONFIG" 2>/dev/null)
[ -z "$ORG_SLUG" ] && exit 0

AICTRL_API_KEY=$(jq -r ".orgs[\\"$ORG_SLUG\\"].apiKey // empty" "$AICTRL_CREDENTIALS" 2>/dev/null)
[ -z "$AICTRL_API_KEY" ] && exit 0

AICTRL_REPO_URL=$(git -C "$PROJECT_ROOT" remote get-url origin 2>/dev/null || echo "")
AICTRL_BASE_URL="${baseUrl}"`;
}

export function telemetrySendSnippet(): string {
  return `# Send telemetry (fire-and-forget, never blocks)
send_telemetry() {
  local SKILL="$1"
  local SOURCE="$2"

  MACHINE_ID=$(hostname | sha256sum 2>/dev/null | cut -d' ' -f1 | head -c 16 || echo "unknown")
  TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%S.000Z")

  PAYLOAD=$(jq -n \\
    --arg sn "$SKILL" \\
    --arg src "$SOURCE" \\
    --arg repo "$AICTRL_REPO_URL" \\
    --arg mid "$MACHINE_ID" \\
    --arg ts "$TIMESTAMP" \\
    '{skillName: $sn, source: $src, repoUrl: $repo, machineId: $mid, timestamp: $ts}')

  curl -s -X POST \\
    "$AICTRL_BASE_URL/api/telemetry/skill-usage" \\
    -H "Content-Type: application/json" \\
    -H "X-API-Key: $AICTRL_API_KEY" \\
    -d "$PAYLOAD" \\
    --connect-timeout 3 \\
    --max-time 5 \\
    > /dev/null 2>&1 || true
}`;
}
```

- [ ] **Step 2: Create Claude Code hook template**

Create `src/hooks/claude.sh.ts`:

```typescript
import { credentialResolverSnippet, telemetrySendSnippet } from './resolve-credentials.sh.js';

export function generateClaudeHook(baseUrl: string): string {
  return `#!/bin/bash
# aictrl telemetry hook for Claude Code (PostToolUse → Read)
# Auto-generated by @aictrl/setup — do not edit manually

set -euo pipefail

${credentialResolverSnippet(baseUrl)}

# Only trigger on Read tool
TOOL_NAME=$(echo "$TOOL_USE_RESULT" | jq -r '.tool_name // empty' 2>/dev/null)
[ "$TOOL_NAME" != "Read" ] && exit 0

FILE_PATH=$(echo "$TOOL_USE_RESULT" | jq -r '.tool_input.file_path // empty' 2>/dev/null)

# Only trigger for skill/command files
case "$FILE_PATH" in
  */.claude/skills/*.md|*/.claude/commands/*.md) ;;
  */skills/*/SKILL.md) ;;
  *) exit 0 ;;
esac

# Extract skill name by walking up to skills/ or commands/ parent
dir="$(dirname "$FILE_PATH")"
SKILL_NAME="$(basename "$FILE_PATH" .md)"
while [ "$(basename "$dir")" != "skills" ] && \\
      [ "$(basename "$dir")" != "commands" ] && \\
      [ "$dir" != "/" ]; do
  SKILL_NAME="$(basename "$dir")"
  dir="$(dirname "$dir")"
done

# Normalize: lowercase, non-alphanumeric → hyphens
SKILL_NAME=$(echo "$SKILL_NAME" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9-]/-/g')

# Validate format
if ! echo "$SKILL_NAME" | grep -qE '^[a-z0-9][a-z0-9-]{0,98}[a-z0-9]$'; then
  exit 0
fi

${telemetrySendSnippet()}

send_telemetry "$SKILL_NAME" "claude-code"
`;
}
```

- [ ] **Step 3: Create OpenCode hook template**

Create `src/hooks/opencode.sh.ts`:

```typescript
import { credentialResolverSnippet, telemetrySendSnippet } from './resolve-credentials.sh.js';

export function generateOpenCodeHook(baseUrl: string): string {
  return `#!/bin/bash
# aictrl telemetry hook for OpenCode (skill tool invocation)
# Auto-generated by @aictrl/setup — do not edit manually

set -euo pipefail

${credentialResolverSnippet(baseUrl)}

# Only trigger on skill tool
TOOL_NAME=$(echo "$INPUT" | jq -r '.tool_name // empty' 2>/dev/null)
[ "$TOOL_NAME" != "skill" ] && exit 0

SKILL_NAME=$(echo "$INPUT" | jq -r '.tool_input.name // empty' 2>/dev/null)
[ -z "$SKILL_NAME" ] && exit 0

# Normalize
SKILL_NAME=$(echo "$SKILL_NAME" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9-]/-/g')

if ! echo "$SKILL_NAME" | grep -qE '^[a-z0-9][a-z0-9-]{0,98}[a-z0-9]$'; then
  exit 0
fi

${telemetrySendSnippet()}

send_telemetry "$SKILL_NAME" "opencode"
`;
}
```

- [ ] **Step 4: Create Cursor hook template**

Create `src/hooks/cursor.sh.ts`:

```typescript
import { credentialResolverSnippet, telemetrySendSnippet } from './resolve-credentials.sh.js';

export function generateCursorHook(baseUrl: string): string {
  return `#!/bin/bash
# aictrl telemetry hook for Cursor (beforeReadFile)
# Auto-generated by @aictrl/setup — do not edit manually

set -euo pipefail

${credentialResolverSnippet(baseUrl)}

FILE_PATH=$(echo "$INPUT" | jq -r '.file_path // empty' 2>/dev/null)

# Only trigger for skill files
case "$FILE_PATH" in
  */skills/*.md|*/skills/**/*.md) ;;
  *) echo '{"permission":"allow"}'; exit 0 ;;
esac

# Extract skill name from directory
SKILL_DIR=$(dirname "$FILE_PATH")
SKILL_NAME=$(basename "$SKILL_DIR")
if echo "$SKILL_NAME" | grep -q "^skills$"; then
  SKILL_NAME=$(basename "$FILE_PATH" .md)
fi

# Normalize
SKILL_NAME=$(echo "$SKILL_NAME" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9-]/-/g')

if ! echo "$SKILL_NAME" | grep -qE '^[a-z0-9][a-z0-9-]{0,98}[a-z0-9]$'; then
  echo '{"permission":"allow"}'
  exit 0
fi

${telemetrySendSnippet()}

send_telemetry "$SKILL_NAME" "cursor"
echo '{"permission":"allow"}'
`;
}
```

- [ ] **Step 5: Verify build compiles all hook templates**

Run: `npm run build`
Expected: No errors. `dist/hooks/` directory contains compiled JS files.

- [ ] **Step 6: Commit**

```bash
git add src/hooks/
git commit -m "feat: add telemetry hook templates for Claude Code, OpenCode, Cursor"
```

---

### Task 7: Claude Code Plugin Writer

**Files:**
- Create: `src/writers/claude.ts`
- Create: `test/writers/claude.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `test/writers/claude.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, readFile, mkdir, writeFile } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { existsSync } from 'fs';
import { installClaudePlugin } from '../src/writers/claude.js';
import type { WritableSkill } from '../src/writers/shared.js';

describe('installClaudePlugin', () => {
  let tempHome: string;
  let pluginsCache: string;
  let settingsFile: string;

  const skills: WritableSkill[] = [
    {
      name: 'code-review',
      markdown: '---\nname: code-review\n---\n\nReview code.',
      files: [],
    },
    {
      name: 'tdd',
      markdown: '---\nname: tdd\n---\n\nTDD guide.',
      files: [{ path: 'references/checklist.md', content: '# Checklist' }],
    },
  ];

  beforeEach(async () => {
    tempHome = await mkdtemp(join(tmpdir(), 'aictrl-test-'));
    pluginsCache = join(tempHome, '.claude', 'plugins', 'cache');
    settingsFile = join(tempHome, '.claude', 'settings.json');
  });

  afterEach(async () => {
    await rm(tempHome, { recursive: true });
  });

  it('creates plugin directory with correct structure', async () => {
    await installClaudePlugin({
      orgSlug: 'talentrix',
      skills,
      apiKey: 'sk_live_xxx',
      baseUrl: 'https://aictrl.dev',
      pluginsCache,
      settingsFile,
    });

    const pluginDir = join(pluginsCache, 'aictrl-talentrix@aictrl');
    expect(existsSync(join(pluginDir, '.claude-plugin', 'plugin.json'))).toBe(true);
    expect(existsSync(join(pluginDir, 'skills', 'code-review', 'SKILL.md'))).toBe(true);
    expect(existsSync(join(pluginDir, 'skills', 'tdd', 'SKILL.md'))).toBe(true);
    expect(existsSync(join(pluginDir, 'skills', 'tdd', 'references', 'checklist.md'))).toBe(true);
    expect(existsSync(join(pluginDir, '.mcp.json'))).toBe(true);
  });

  it('writes correct plugin.json', async () => {
    await installClaudePlugin({
      orgSlug: 'talentrix',
      skills,
      apiKey: 'sk_live_xxx',
      baseUrl: 'https://aictrl.dev',
      pluginsCache,
      settingsFile,
    });

    const pluginJson = JSON.parse(
      await readFile(join(pluginsCache, 'aictrl-talentrix@aictrl', '.claude-plugin', 'plugin.json'), 'utf-8')
    );
    expect(pluginJson.name).toBe('aictrl-talentrix');
    expect(pluginJson.mcpServers).toBe('./.mcp.json');
  });

  it('writes .mcp.json with correct MCP config', async () => {
    await installClaudePlugin({
      orgSlug: 'talentrix',
      skills,
      apiKey: 'sk_live_xxx',
      baseUrl: 'https://aictrl.dev',
      pluginsCache,
      settingsFile,
    });

    const mcpJson = JSON.parse(
      await readFile(join(pluginsCache, 'aictrl-talentrix@aictrl', '.mcp.json'), 'utf-8')
    );
    expect(mcpJson.mcpServers['aictrl-talentrix'].url).toBe('https://aictrl.dev/talentrix/mcp');
    expect(mcpJson.mcpServers['aictrl-talentrix'].headers.Authorization).toBe('Bearer sk_live_xxx');
  });

  it('registers plugin in settings.json', async () => {
    await installClaudePlugin({
      orgSlug: 'talentrix',
      skills,
      apiKey: 'sk_live_xxx',
      baseUrl: 'https://aictrl.dev',
      pluginsCache,
      settingsFile,
    });

    const settings = JSON.parse(await readFile(settingsFile, 'utf-8'));
    expect(settings.enabledPlugins['aictrl-talentrix@aictrl']).toBe(true);
  });

  it('preserves existing settings when merging', async () => {
    await mkdir(join(tempHome, '.claude'), { recursive: true });
    await writeFile(settingsFile, JSON.stringify({
      theme: 'dark',
      enabledPlugins: { 'other-plugin@market': true },
    }));

    await installClaudePlugin({
      orgSlug: 'talentrix',
      skills,
      apiKey: 'sk_live_xxx',
      baseUrl: 'https://aictrl.dev',
      pluginsCache,
      settingsFile,
    });

    const settings = JSON.parse(await readFile(settingsFile, 'utf-8'));
    expect(settings.theme).toBe('dark');
    expect(settings.enabledPlugins['other-plugin@market']).toBe(true);
    expect(settings.enabledPlugins['aictrl-talentrix@aictrl']).toBe(true);
  });

  it('clears old skills on re-install', async () => {
    await installClaudePlugin({
      orgSlug: 'talentrix',
      skills,
      apiKey: 'sk_live_xxx',
      baseUrl: 'https://aictrl.dev',
      pluginsCache,
      settingsFile,
    });

    const newSkills: WritableSkill[] = [
      { name: 'deploy', markdown: '---\nname: deploy\n---\n\nDeploy.', files: [] },
    ];

    await installClaudePlugin({
      orgSlug: 'talentrix',
      skills: newSkills,
      apiKey: 'sk_live_xxx',
      baseUrl: 'https://aictrl.dev',
      pluginsCache,
      settingsFile,
    });

    const pluginDir = join(pluginsCache, 'aictrl-talentrix@aictrl');
    expect(existsSync(join(pluginDir, 'skills', 'deploy', 'SKILL.md'))).toBe(true);
    expect(existsSync(join(pluginDir, 'skills', 'code-review'))).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — `writers/claude.js` does not exist.

- [ ] **Step 3: Implement claude.ts**

Create `src/writers/claude.ts`:

```typescript
import { writeFile, mkdir, readFile } from 'fs/promises';
import { join } from 'path';
import { writeSkill, clearSkillsDir, type WritableSkill } from './shared.js';
import { generateClaudeHook } from '../hooks/claude.sh.js';

export interface ClaudePluginOptions {
  orgSlug: string;
  skills: WritableSkill[];
  apiKey: string;
  baseUrl: string;
  pluginsCache: string;
  settingsFile: string;
}

export async function installClaudePlugin(options: ClaudePluginOptions): Promise<void> {
  const { orgSlug, skills, apiKey, baseUrl, pluginsCache, settingsFile } = options;
  const pluginId = `aictrl-${orgSlug}`;
  const pluginDirName = `${pluginId}@aictrl`;
  const pluginDir = join(pluginsCache, pluginDirName);
  const skillsDir = join(pluginDir, 'skills');

  // Clear and recreate skills directory
  await clearSkillsDir(skillsDir);

  // Write plugin.json
  const pluginJsonDir = join(pluginDir, '.claude-plugin');
  await mkdir(pluginJsonDir, { recursive: true });
  await writeFile(
    join(pluginJsonDir, 'plugin.json'),
    JSON.stringify(
      {
        name: pluginId,
        description: `aictrl skills for ${orgSlug}`,
        version: '1.0.0',
        author: { name: 'aictrl.dev' },
        homepage: 'https://aictrl.dev',
        mcpServers: './.mcp.json',
      },
      null,
      2,
    ) + '\n',
    'utf-8',
  );

  // Write .mcp.json
  await writeFile(
    join(pluginDir, '.mcp.json'),
    JSON.stringify(
      {
        mcpServers: {
          [pluginId]: {
            type: 'http',
            url: `${baseUrl}/${orgSlug}/mcp`,
            headers: { Authorization: `Bearer ${apiKey}` },
          },
        },
      },
      null,
      2,
    ) + '\n',
    'utf-8',
  );

  // Write skills
  for (const skill of skills) {
    await writeSkill(skillsDir, skill);
  }

  // Write telemetry hook
  const hooksDir = join(pluginDir, 'hooks');
  await mkdir(hooksDir, { recursive: true });
  await writeFile(join(hooksDir, 'skill-telemetry.sh'), generateClaudeHook(baseUrl), {
    mode: 0o755,
  });

  // Register plugin in settings.json
  await mergeSettings(settingsFile, pluginDirName);
}

async function mergeSettings(settingsFile: string, pluginDirName: string): Promise<void> {
  let settings: Record<string, unknown> = {};
  try {
    const content = await readFile(settingsFile, 'utf-8');
    settings = JSON.parse(content);
  } catch {
    // File doesn't exist or is invalid — start fresh
  }

  const enabledPlugins = (settings.enabledPlugins ?? {}) as Record<string, boolean>;
  enabledPlugins[pluginDirName] = true;
  settings.enabledPlugins = enabledPlugins;

  await mkdir(join(settingsFile, '..'), { recursive: true });
  await writeFile(settingsFile, JSON.stringify(settings, null, 2) + '\n', 'utf-8');
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: All Claude writer tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/writers/claude.ts test/writers/claude.test.ts
git commit -m "feat: add Claude Code plugin writer with MCP and settings merge"
```

---

### Task 8: OpenCode Writer

**Files:**
- Create: `src/writers/opencode.ts`
- Create: `test/writers/opencode.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `test/writers/opencode.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, readFile, stat } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { existsSync } from 'fs';
import { installOpenCode } from '../src/writers/opencode.js';
import type { WritableSkill } from '../src/writers/shared.js';

describe('installOpenCode', () => {
  let tempDir: string;

  const skills: WritableSkill[] = [
    {
      name: 'code-review',
      markdown: '---\nname: code-review\n---\n\nReview code.',
      files: [],
    },
  ];

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'aictrl-test-'));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true });
  });

  it('writes skills to .opencode/skills/', async () => {
    await installOpenCode({
      projectDir: tempDir,
      skills,
      baseUrl: 'https://aictrl.dev',
    });

    const content = await readFile(
      join(tempDir, '.opencode', 'skills', 'code-review', 'SKILL.md'),
      'utf-8',
    );
    expect(content).toContain('Review code.');
  });

  it('writes telemetry hook with executable permissions', async () => {
    await installOpenCode({
      projectDir: tempDir,
      skills,
      baseUrl: 'https://aictrl.dev',
    });

    const hookPath = join(tempDir, '.opencode', 'hooks', 'skill-telemetry.sh');
    expect(existsSync(hookPath)).toBe(true);
    const hookStat = await stat(hookPath);
    expect(hookStat.mode & 0o111).toBeGreaterThan(0);
  });

  it('clears old skills on re-install', async () => {
    await installOpenCode({ projectDir: tempDir, skills, baseUrl: 'https://aictrl.dev' });
    expect(existsSync(join(tempDir, '.opencode', 'skills', 'code-review'))).toBe(true);

    const newSkills: WritableSkill[] = [
      { name: 'deploy', markdown: 'Deploy.', files: [] },
    ];
    await installOpenCode({ projectDir: tempDir, skills: newSkills, baseUrl: 'https://aictrl.dev' });

    expect(existsSync(join(tempDir, '.opencode', 'skills', 'deploy', 'SKILL.md'))).toBe(true);
    expect(existsSync(join(tempDir, '.opencode', 'skills', 'code-review'))).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — `writers/opencode.js` does not exist.

- [ ] **Step 3: Implement opencode.ts**

Create `src/writers/opencode.ts`:

```typescript
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { writeSkill, clearSkillsDir, type WritableSkill } from './shared.js';
import { generateOpenCodeHook } from '../hooks/opencode.sh.js';

export interface OpenCodeOptions {
  projectDir: string;
  skills: WritableSkill[];
  baseUrl: string;
}

export async function installOpenCode(options: OpenCodeOptions): Promise<void> {
  const { projectDir, skills, baseUrl } = options;
  const skillsDir = join(projectDir, '.opencode', 'skills');
  const hooksDir = join(projectDir, '.opencode', 'hooks');

  // Clear and rewrite skills
  await clearSkillsDir(skillsDir);
  for (const skill of skills) {
    await writeSkill(skillsDir, skill);
  }

  // Write telemetry hook
  await mkdir(hooksDir, { recursive: true });
  await writeFile(join(hooksDir, 'skill-telemetry.sh'), generateOpenCodeHook(baseUrl), {
    mode: 0o755,
  });
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: All OpenCode writer tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/writers/opencode.ts test/writers/opencode.test.ts
git commit -m "feat: add OpenCode standalone skill writer"
```

---

### Task 9: Cursor Writer

**Files:**
- Create: `src/writers/cursor.ts`
- Create: `test/writers/cursor.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `test/writers/cursor.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, readFile, writeFile as fsWriteFile, mkdir, stat } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { existsSync } from 'fs';
import { installCursor } from '../src/writers/cursor.js';
import type { WritableSkill } from '../src/writers/shared.js';

describe('installCursor', () => {
  let tempDir: string;

  const skills: WritableSkill[] = [
    {
      name: 'code-review',
      markdown: '---\nname: code-review\n---\n\nReview code.',
      files: [],
    },
  ];

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'aictrl-test-'));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true });
  });

  it('writes skills to .cursor/skills/', async () => {
    await installCursor({
      projectDir: tempDir,
      orgSlug: 'talentrix',
      skills,
      apiKey: 'sk_live_xxx',
      baseUrl: 'https://aictrl.dev',
    });

    const content = await readFile(
      join(tempDir, '.cursor', 'skills', 'code-review', 'SKILL.md'),
      'utf-8',
    );
    expect(content).toContain('Review code.');
  });

  it('writes MCP config to .cursor/mcp.json', async () => {
    await installCursor({
      projectDir: tempDir,
      orgSlug: 'talentrix',
      skills,
      apiKey: 'sk_live_xxx',
      baseUrl: 'https://aictrl.dev',
    });

    const mcpJson = JSON.parse(
      await readFile(join(tempDir, '.cursor', 'mcp.json'), 'utf-8'),
    );
    expect(mcpJson.mcpServers['aictrl-talentrix'].url).toBe('https://aictrl.dev/talentrix/mcp');
    expect(mcpJson.mcpServers['aictrl-talentrix'].headers.Authorization).toBe('Bearer sk_live_xxx');
  });

  it('preserves existing MCP servers when merging', async () => {
    await mkdir(join(tempDir, '.cursor'), { recursive: true });
    await fsWriteFile(
      join(tempDir, '.cursor', 'mcp.json'),
      JSON.stringify({ mcpServers: { 'other-server': { url: 'http://other' } } }),
    );

    await installCursor({
      projectDir: tempDir,
      orgSlug: 'talentrix',
      skills,
      apiKey: 'sk_live_xxx',
      baseUrl: 'https://aictrl.dev',
    });

    const mcpJson = JSON.parse(
      await readFile(join(tempDir, '.cursor', 'mcp.json'), 'utf-8'),
    );
    expect(mcpJson.mcpServers['other-server'].url).toBe('http://other');
    expect(mcpJson.mcpServers['aictrl-talentrix']).toBeDefined();
  });

  it('writes telemetry hook with executable permissions', async () => {
    await installCursor({
      projectDir: tempDir,
      orgSlug: 'talentrix',
      skills,
      apiKey: 'sk_live_xxx',
      baseUrl: 'https://aictrl.dev',
    });

    const hookPath = join(tempDir, '.cursor', 'hooks', 'skill-telemetry.sh');
    expect(existsSync(hookPath)).toBe(true);
    const hookStat = await stat(hookPath);
    expect(hookStat.mode & 0o111).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — `writers/cursor.js` does not exist.

- [ ] **Step 3: Implement cursor.ts**

Create `src/writers/cursor.ts`:

```typescript
import { writeFile, mkdir, readFile } from 'fs/promises';
import { join } from 'path';
import { writeSkill, clearSkillsDir, type WritableSkill } from './shared.js';
import { generateCursorHook } from '../hooks/cursor.sh.js';

export interface CursorOptions {
  projectDir: string;
  orgSlug: string;
  skills: WritableSkill[];
  apiKey: string;
  baseUrl: string;
}

export async function installCursor(options: CursorOptions): Promise<void> {
  const { projectDir, orgSlug, skills, apiKey, baseUrl } = options;
  const skillsDir = join(projectDir, '.cursor', 'skills');
  const hooksDir = join(projectDir, '.cursor', 'hooks');
  const mcpFile = join(projectDir, '.cursor', 'mcp.json');

  // Clear and rewrite skills
  await clearSkillsDir(skillsDir);
  for (const skill of skills) {
    await writeSkill(skillsDir, skill);
  }

  // Merge MCP config
  await mergeMcpConfig(mcpFile, orgSlug, apiKey, baseUrl);

  // Write telemetry hook
  await mkdir(hooksDir, { recursive: true });
  await writeFile(join(hooksDir, 'skill-telemetry.sh'), generateCursorHook(baseUrl), {
    mode: 0o755,
  });
}

async function mergeMcpConfig(
  mcpFile: string,
  orgSlug: string,
  apiKey: string,
  baseUrl: string,
): Promise<void> {
  let mcpConfig: Record<string, unknown> = {};
  try {
    const content = await readFile(mcpFile, 'utf-8');
    mcpConfig = JSON.parse(content);
  } catch {
    // File doesn't exist — start fresh
  }

  const mcpServers = (mcpConfig.mcpServers ?? {}) as Record<string, unknown>;
  mcpServers[`aictrl-${orgSlug}`] = {
    url: `${baseUrl}/${orgSlug}/mcp`,
    headers: { Authorization: `Bearer ${apiKey}` },
  };
  mcpConfig.mcpServers = mcpServers;

  await mkdir(join(mcpFile, '..'), { recursive: true });
  await writeFile(mcpFile, JSON.stringify(mcpConfig, null, 2) + '\n', 'utf-8');
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: All Cursor writer tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/writers/cursor.ts test/writers/cursor.test.ts
git commit -m "feat: add Cursor skill writer with MCP merge"
```

---

### Task 10: Gitignore Helper

**Files:**
- Create: `src/gitignore.ts`
- Create: `test/gitignore.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `test/gitignore.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, readFile, writeFile } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { ensureGitignore } from '../src/gitignore.js';

describe('ensureGitignore', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'aictrl-test-'));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true });
  });

  it('creates .gitignore if it does not exist', async () => {
    await ensureGitignore(tempDir, ['.cursor/mcp.json']);
    const content = await readFile(join(tempDir, '.gitignore'), 'utf-8');
    expect(content).toContain('.cursor/mcp.json');
  });

  it('appends missing entries to existing .gitignore', async () => {
    await writeFile(join(tempDir, '.gitignore'), 'node_modules/\n');
    await ensureGitignore(tempDir, ['.cursor/mcp.json']);
    const content = await readFile(join(tempDir, '.gitignore'), 'utf-8');
    expect(content).toContain('node_modules/');
    expect(content).toContain('.cursor/mcp.json');
  });

  it('does not duplicate existing entries', async () => {
    await writeFile(join(tempDir, '.gitignore'), '.cursor/mcp.json\n');
    await ensureGitignore(tempDir, ['.cursor/mcp.json']);
    const content = await readFile(join(tempDir, '.gitignore'), 'utf-8');
    const matches = content.match(/\.cursor\/mcp\.json/g);
    expect(matches).toHaveLength(1);
  });

  it('handles multiple entries', async () => {
    await ensureGitignore(tempDir, ['.cursor/mcp.json', '.env']);
    const content = await readFile(join(tempDir, '.gitignore'), 'utf-8');
    expect(content).toContain('.cursor/mcp.json');
    expect(content).toContain('.env');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — `gitignore.js` does not exist.

- [ ] **Step 3: Implement gitignore.ts**

Create `src/gitignore.ts`:

```typescript
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: All gitignore tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/gitignore.ts test/gitignore.test.ts
git commit -m "feat: add gitignore helper to append missing entries"
```

---

### Task 11: CLI Entry Point

**Files:**
- Create: `src/cli.ts`

This is the orchestration layer. It ties together all the modules built in Tasks 1-10.

- [ ] **Step 1: Implement cli.ts**

Create `src/cli.ts`:

```typescript
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
```

- [ ] **Step 2: Verify build compiles**

Run: `npm run build`
Expected: Clean build, no errors. `dist/cli.js` produced.

- [ ] **Step 3: Commit**

```bash
git add src/cli.ts
git commit -m "feat: add CLI entry point with interactive and non-interactive modes"
```

---

### Task 12: Integration Smoke Test

**Files:**
- Modify: `bin/setup.js`

- [ ] **Step 1: Verify bin/setup.js imports correctly**

Run: `node bin/setup.js --help 2>&1 || true`
Expected: The script runs (may error on missing args, but should not throw module-not-found).

- [ ] **Step 2: Test non-interactive mode with mock server (manual)**

This is a manual verification step. In a separate terminal, verify the CLI flow works end to end by running:

```bash
npx @aictrl/setup --org talentrix --api-key sk_live_test --editors claude --non-interactive --base-url http://localhost:3005
```

Against the dev server running on port 3005 (per CLAUDE.md conventions). Verify:
- Plugin directory created at `~/.claude/plugins/cache/aictrl-talentrix@aictrl/`
- Skills written with correct SKILL.md format
- `~/.claude/settings.json` has `enabledPlugins` entry
- `~/.aictrl/credentials.json` has the org entry
- `.aictrl.json` has the org slug

- [ ] **Step 3: Run full test suite**

Run: `npm test`
Expected: All tests pass (config, credentials, verify, fetch-skills, shared writer, claude writer, opencode writer, cursor writer, gitignore).

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore: verify integration and finalize build"
```

---

## Execution Summary

| Task | What it builds | Key files |
|------|---------------|-----------|
| 1 | Project scaffolding | package.json, tsconfig, config.ts |
| 2 | Credential management | credentials.ts |
| 3 | API key verification | verify.ts |
| 4 | Marketplace fetching | fetch-skills.ts |
| 5 | Shared skill writer | writers/shared.ts |
| 6 | Hook templates | hooks/*.sh.ts |
| 7 | Claude Code plugin writer | writers/claude.ts |
| 8 | OpenCode writer | writers/opencode.ts |
| 9 | Cursor writer | writers/cursor.ts |
| 10 | Gitignore helper | gitignore.ts |
| 11 | CLI orchestration | cli.ts |
| 12 | Integration smoke test | Manual verification |

Each task is independently testable and produces a commit. Tasks 1-5 are foundational, 6-10 are the editor-specific writers, 11-12 tie everything together.
