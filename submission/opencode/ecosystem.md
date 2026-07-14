# OpenCode Ecosystem submission

Do not open the upstream issue or pull request until `@aictrl/opencode` is
publicly installable and the exact published version passes the clean lifecycle
smoke. Submission is not publication; keep aictrl-dev/aictrl#3865 open until the
upstream PR is merged and the live Ecosystem link is smoke-tested.

## Upstream target

- Repository: `anomalyco/opencode`
- Base branch: `dev`
- File: `packages/web/src/content/docs/ecosystem.mdx`
- Section: `Plugins`

The upstream contribution policy requires an issue before every PR. Use its
feature-request form and keep both descriptions short.

## Preconditions

```bash
npm view @aictrl/opencode version dist-tags --json
npx @aictrl/opencode --project .
opencode mcp list
npx @aictrl/opencode --project . --uninstall
```

Record the public version, `beta` dist-tag, successful clean install, exact
versioned MCP URL, OAuth-required boundary, uninstall result, and UTC time.

## Upstream issue

Title:

```text
[FEATURE]: List @aictrl/opencode in the Ecosystem
```

Body:

```markdown
### Feature hasn't been suggested before

- [x] I have verified this feature I'm about to request hasn't been suggested before.

### Describe the enhancement you want to request

Add `@aictrl/opencode` to the Plugins table in `packages/web/src/content/docs/ecosystem.mdx`. It gives OpenCode users eight local SDLC skills plus an optional OAuth-connected AICtrl workflow MCP. The npm package is public and its clean install, MCP discovery, repeat install, and uninstall lifecycle has been verified.
```

Search open and closed upstream issues immediately before creating this issue;
reuse an existing matching issue instead of creating a duplicate.

## One-row documentation change

Append this row to the English `Plugins` table only, matching recent accepted
Ecosystem additions:

```markdown
| [@aictrl/opencode](https://github.com/aictrl-dev/aictrl-plugin/tree/main/opencode)                   | Install eight portable SDLC skills and optional OAuth-connected AICtrl workflows                    |
```

PR title:

```text
docs: add AICtrl to the OpenCode ecosystem
```

PR body:

```markdown
### Issue for this PR

Closes #<upstream-issue>

### Type of change

- [ ] Bug fix
- [ ] New feature
- [ ] Refactor / code improvement
- [x] Documentation

### What does this PR do?

Adds the public `@aictrl/opencode` package to the Plugins table. It installs eight portable SDLC skills and an optional OAuth-connected workflow MCP.

### How did you verify your code works?

Public npm install, MCP discovery, repeat install, and uninstall passed for version <published-version>. The PR changes only the English Ecosystem table.

### Screenshots / recordings

N/A — documentation-only change.

### Checklist

- [x] I have tested my changes locally
- [x] I have not included unrelated changes in this PR
```

Do not expand the PR beyond the one English Ecosystem row unless an upstream
maintainer explicitly requests translated pages or other changes.

## After merge

Verify the live Ecosystem page links to the public repository, install the npm
package from a clean OpenCode client, complete one local skill, complete the
connected OAuth workflow smoke, and record the upstream issue, PR, merge commit,
live URL, package version, and evidence on aictrl-dev/aictrl#3865.
