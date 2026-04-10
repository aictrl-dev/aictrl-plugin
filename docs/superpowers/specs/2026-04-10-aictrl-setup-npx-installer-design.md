# @aictrl/setup — npx Installer Design

**Issue:** aictrl-dev/aictrl#1258
**Date:** 2026-04-10
**Status:** Draft

## Overview

A single npm package (`@aictrl/setup`) that configures a developer's project with aictrl skills, telemetry hooks, and MCP integration across Claude Code, OpenCode, and Cursor.

```bash
npx @aictrl/setup --org talentrix
```

## Approach

Pure file writer — the installer fetches skills from the marketplace API and writes everything directly. No dependency on any editor CLI being installed. Same fetch logic for all editors, only output paths and formats differ.

## CLI Interface

### Interactive mode

```bash
npx @aictrl/setup
```

Prompts for:
1. Org slug
2. API key (if not already stored for this org)
3. Editor selection (multi-select: Claude Code, OpenCode, Cursor)

### Explicit org

```bash
npx @aictrl/setup --org talentrix
```

Skips org prompt. Skips API key prompt if already stored.

### Non-interactive (CI)

```bash
npx @aictrl/setup --org talentrix --api-key sk_live_xxx --editors claude,opencode,cursor --non-interactive
```

All values from flags. Writes credentials and installs without prompts.

### Output

```
aictrl.dev — Developer Setup

? Select editors to configure:
  [x] Claude Code
  [ ] OpenCode
  [x] Cursor

? API Key: sk_live_****
? Org slug: talentrix

Verifying API key... ✓
Fetching 23 skills for talentrix...

Claude Code:
  ✓ Installed plugin aictrl-talentrix (23 skills)
  ✓ Configured MCP server aictrl-talentrix
  ✓ Installed telemetry hook

Cursor:
  ✓ Wrote 23 skills to .cursor/skills/
  ✓ Configured MCP server in .cursor/mcp.json
  ✓ Installed telemetry hook

Done! Skills are ready to use.
Run npx @aictrl/setup again to update skills.
```

## Credential Storage

Two files with clear separation of concerns.

### Global credentials (`~/.aictrl/credentials.json`)

Stored per machine, contains secrets. Written with `0600` permissions.

```json
{
  "orgs": {
    "talentrix": { "apiKey": "sk_live_xxx" },
    "project2": { "apiKey": "sk_live_yyy" }
  }
}
```

### Per-project org pointer (`.aictrl.json`)

Stored in project root, safe to commit, no secrets.

```json
{
  "orgSlug": "talentrix"
}
```

### Resolution order

At runtime (hooks, MCP):
1. Read org slug from `.aictrl.json` in the project root
2. Look up API key from `~/.aictrl/credentials.json` by org slug
3. If either is missing, fail silently (hooks) or with error (installer)

### No environment variables

All config reads from these two files. CI passes credentials via `--api-key` flag which writes to `credentials.json`. One mechanism, not two.

### Key rotation

Re-run `npx @aictrl/setup --org talentrix`, prompted for new key (or pass `--api-key`). Updates `credentials.json`. No need to touch hooks or project files — they resolve at runtime.

## Skill Fetching

### API calls

1. `GET /:shortOrgId/:apiKey/marketplace.json` — skill list with names, descriptions, versions, tags
2. `GET /:shortOrgId/:apiKey/plugins/:name/SKILL.md` — full skill content with YAML frontmatter (per skill)
3. `GET /:shortOrgId/:apiKey/plugins/:name/.claude-plugin/plugin.json` — check for `files` array (directory-based skills)
4. `GET /:shortOrgId/:apiKey/plugins/:name/:filePath` — supporting files (references/, scripts/, assets/)

### Concurrency

Fetch skills in parallel, batches of 10 to respect 60 req/min rate limit.

### MCP connector filtering

The marketplace.json includes an auto-generated `aictrl-<slug>` MCP connector plugin. The installer filters this out of the skill list and uses its metadata to configure MCP instead.

### Error handling

- 401 on marketplace.json → "Invalid API key or org slug"
- 404 on individual skill → warn and skip, continue with others
- Network timeout → retry once, then fail with clear message

## File Writers

### Shared skill writer

All editors use the same SKILL.md format with YAML frontmatter, matching the existing `write-skills.cjs` implementation:

```yaml
---
name: skill-name
description: "Human-readable description"
allowedTools:
  - ToolName
tags:
  - category
version: "1.0.0"
---

[Skill markdown content]
```

Supporting files (references/, scripts/, assets/) are written alongside SKILL.md preserving directory structure.

### Claude Code — Plugin installation

Installs as a proper Claude Code plugin. Skills are namespaced as `aictrl-<slug>:skill-name`.

**Directory:** `~/.claude/plugins/cache/aictrl-<slug>@aictrl/`

```
~/.claude/plugins/cache/aictrl-talentrix@aictrl/
├── .claude-plugin/
│   └── plugin.json
├── skills/
│   ├── code-review/
│   │   └── SKILL.md
│   ├── tdd/
│   │   ├── SKILL.md
│   │   └── references/
│   │       └── checklist.md
│   └── ...
├── hooks/
│   └── skill-telemetry.sh
└── .mcp.json
```

**plugin.json:**
```json
{
  "name": "aictrl-talentrix",
  "description": "aictrl skills for Talentrix Inc",
  "version": "1.0.0",
  "author": { "name": "aictrl.dev" },
  "homepage": "https://aictrl.dev",
  "mcpServers": "./.mcp.json"
}
```

**.mcp.json:**
```json
{
  "mcpServers": {
    "aictrl-talentrix": {
      "type": "http",
      "url": "https://aictrl.dev/talentrix/mcp",
      "headers": { "Authorization": "Bearer <actual-api-key>" }
    }
  }
}
```

**Registration:** Merge `enabledPlugins` into `~/.claude/settings.json`:
```json
{
  "enabledPlugins": {
    "aictrl-talentrix@aictrl": true
  }
}
```

**Multi-org:** Each org gets its own plugin directory and `enabledPlugins` entry. Multiple orgs coexist naturally via plugin namespacing.

### OpenCode — Standalone skills

```
.opencode/
├── skills/<name>/SKILL.md
└── hooks/skill-telemetry.sh
```

One org per project. Prints MCP config instructions for user to add to `opencode.json`.

### Cursor — Standalone skills

```
.cursor/
├── skills/<name>/SKILL.md
├── hooks/skill-telemetry.sh
└── mcp.json                        # Merge MCP entry
```

One org per project. MCP config written directly to `.cursor/mcp.json`.

**.cursor/mcp.json** (merged, not overwritten):
```json
{
  "mcpServers": {
    "aictrl-talentrix": {
      "url": "https://aictrl.dev/talentrix/mcp",
      "headers": { "Authorization": "Bearer <actual-api-key>" }
    }
  }
}
```

### Gitignore

The installer appends to `.gitignore` if not already present:
- `.cursor/mcp.json` (contains API key in MCP headers)

Claude Code secrets are in `~/.claude/` (user home), so no project gitignore needed.

## Telemetry Hooks

### Credential resolution (shared)

All hook scripts resolve credentials at runtime:

```bash
ORG_SLUG=$(jq -r '.orgSlug' .aictrl.json 2>/dev/null)
API_KEY=$(jq -r ".orgs[\"$ORG_SLUG\"].apiKey" ~/.aictrl/credentials.json 2>/dev/null)
REPO_URL=$(git remote get-url origin 2>/dev/null || echo "")
```

If either value is missing, the hook exits silently. Hooks never block the editor.

### Claude Code hook

- Location: inside plugin at `hooks/skill-telemetry.sh`
- Trigger: `PostToolUse` on `Read` tool
- Detects: file path matching `*/.claude/skills/*.md` or `*/.claude/commands/*.md`
- Extracts skill name by walking up directories to `skills/` or `commands/` parent
- Source: `"claude-code"`

### OpenCode hook

- Location: `.opencode/hooks/skill-telemetry.sh`
- Trigger: tool execution hook on `skill` tool
- Extracts skill name from `tool_input.name`
- Source: `"opencode"`

### Cursor hook

- Location: `.cursor/hooks/skill-telemetry.sh`
- Trigger: `beforeReadFile` hook
- Detects: file path matching `*/skills/*.md`
- Extracts skill name from parent directory
- Source: `"cursor"`

### Telemetry payload

All hooks POST to `{baseUrl}/api/telemetry/skill-usage`:

```json
{
  "skillName": "code-review",
  "source": "claude-code",
  "repoUrl": "git@github.com:acme/backend.git",
  "machineId": "<hashed-hostname-16-chars>",
  "timestamp": "2026-04-10T12:00:00.000Z"
}
```

Timeout: 3s connect, 5s total. Failure is silent.

## Idempotency & Updates

### Re-running for same org

`npx @aictrl/setup --org talentrix`:
- **Skills:** Clears existing skills for the org, writes fresh from API
- **Hooks:** Overwrites hook scripts (generated, not user-edited)
- **Config merges** (settings.json, mcp.json): Updates `aictrl-<slug>` entries only, preserves everything else
- **Credentials:** Skips prompt if key exists. Pass `--api-key` to update.
- **`.aictrl.json`:** Overwrites (no-op if same org)
- **`.gitignore`:** Checks before appending

### Switching orgs (OpenCode/Cursor)

Running `npx @aictrl/setup --org project2` on a project set up for `talentrix`:
- Clears old skills, writes new ones
- Updates `.aictrl.json` to `project2`
- Updates MCP config to point to `project2`
- Warns: "Replacing talentrix skills with project2"

### Switching orgs (Claude Code)

Both plugins coexist — no replacement needed. Each org is a separate plugin.

## Project Structure

```
@aictrl/setup/
├── package.json
├── tsconfig.json
├── bin/
│   └── setup.js                    # Entry point for npx
├── src/
│   ├── cli.ts                      # Arg parsing, interactive prompts, main flow
│   ├── credentials.ts              # Read/write ~/.aictrl/credentials.json and .aictrl.json
│   ├── fetch-skills.ts             # Marketplace API → skill list + content
│   ├── verify.ts                   # GET /skill-usage/verify
│   ├── writers/
│   │   ├── shared.ts               # Write SKILL.md + supporting files
│   │   ├── claude.ts               # Plugin install to ~/.claude/plugins/cache/
│   │   ├── opencode.ts             # .opencode/ skills + hooks
│   │   └── cursor.ts               # .cursor/ skills + mcp.json merge + hooks
│   ├── hooks/
│   │   ├── claude.sh.ts            # Template for Claude Code hook script
│   │   ├── opencode.sh.ts          # Template for OpenCode hook script
│   │   └── cursor.sh.ts            # Template for Cursor hook script
│   ├── gitignore.ts                # Append entries to .gitignore
│   └── config.ts                   # Constants (base URL, paths, defaults)
├── test/
│   ├── credentials.test.ts
│   ├── fetch-skills.test.ts
│   ├── writers/
│   │   ├── claude.test.ts
│   │   ├── opencode.test.ts
│   │   └── cursor.test.ts
│   └── fixtures/
│       ├── marketplace.json
│       └── skill-content.md
└── README.md
```

### Build

TypeScript compiled to `dist/`. `bin/setup.js` imports from `dist/`.

### Dependencies

**Runtime:**
- `inquirer` — interactive prompts

**No other runtime deps.** Uses native `fetch`, `fs`, `crypto`.

**Dev:**
- `typescript`, `vitest`, `@types/node`

## What This Replaces

| Current | Replaced by |
|---------|-------------|
| `curl -sL .../install \| AICTRL_TOOL=cursor bash` | `npx @aictrl/setup` (Cursor) |
| `curl -sL .../install \| AICTRL_TOOL=claude-code bash` | `npx @aictrl/setup` (Claude Code) |
| `curl -sL .../install \| AICTRL_TOOL=opencode bash` | `npx @aictrl/setup` (OpenCode) |
| `/plugin marketplace add .../skills.git` | `npx @aictrl/setup` (Claude Code — installs plugin directly) |
| `npm install -g @aictrl/opencode-plugin` (doesn't exist) | `npx @aictrl/setup` (OpenCode) |
| `AICTRL_API_KEY` env var management | `~/.aictrl/credentials.json` (set once) |

## Out of Scope

- Codex and Gemini CLI support (add when their plugin APIs stabilize)
- Skill authoring/editing (read-only sync from server)
- Auto-updating skills during a session (re-run `npx` to refresh)
- OAuth/browser login flow (API key only for v1)
- Removing the existing `curl | bash` installer (keep as fallback, deprecate later)

## Acceptance Criteria

- [ ] `npx @aictrl/setup` runs without prior installation
- [ ] Interactive prompt for org slug, API key, editor selection
- [ ] `--non-interactive` flag with `--org`, `--api-key`, `--editors` for CI
- [ ] Verifies API key against `/skill-usage/verify` before proceeding
- [ ] Fetches all org skills from marketplace API
- [ ] Fetches supporting files for directory-based skills
- [ ] **Claude Code:** installs as plugin to `~/.claude/plugins/cache/`, registers in `enabledPlugins`, configures MCP via `.mcp.json`, installs telemetry hook
- [ ] **OpenCode:** writes skills to `.opencode/skills/`, installs telemetry hook, prints MCP instructions
- [ ] **Cursor:** writes skills to `.cursor/skills/`, writes `.cursor/mcp.json`, installs telemetry hook
- [ ] Credentials stored in `~/.aictrl/credentials.json` (0600 perms), org pointer in `.aictrl.json`
- [ ] Re-running updates skills without breaking existing config
- [ ] Multiple orgs coexist for Claude Code (separate plugins)
- [ ] One org per project for OpenCode/Cursor (warns on switch)
- [ ] Telemetry hooks resolve credentials at runtime from config files
- [ ] `.gitignore` updated for files containing secrets
- [ ] Fails gracefully with clear errors (invalid key, network down, org not found)
- [ ] Unit tests cover: credential management, marketplace fetch, each writer, config merge, error cases
