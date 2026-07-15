# Public agent package release runbook

Use this runbook for the AICtrl public packages distributed through Claude Code,
Codex/ChatGPT, and OpenCode. A release is complete only when the public artifact
installs from a clean client and the connected workflow reaches a verified
terminal result. Creating a tag, submitting a listing, or passing package CI is
not publication by itself.

## Owners and access

Before starting, record one primary and one backup owner for each item in the
release evidence:

- AICtrl runtime deployment and rollback;
- `aictrl-dev/skills` release and checksums;
- `aictrl-dev/aictrl-plugin` release and GitHub environments;
- the `@aictrl` npm organization and package;
- the OpenAI publisher identity, plugin portal, domain, reviewer account, and
  dedicated public reviewer-fixture repository;
- the OpenCode Ecosystem contribution;
- incident response and customer communication.

Confirm that the owners can use the production accounts before creating a
release. Never put a token, recovery code, reviewer password, or challenge value
in this repository or in release evidence.

## Stop conditions

Stop the release when any of these is true:

- the pinned skills commit or checksum manifest does not match generated files;
- the public MCP catalog is not exactly the six documented workflow lifecycle
  tools;
- a tool schema or annotation differs from deployed behavior;
- OAuth, tenant, repository, workflow, run, or revision authorization fails a
  negative test;
- production health or the OpenCode OAuth-boundary smoke test fails;
- package, secret, lifecycle, or clean-install validation fails;
- support, privacy, terms, publisher identity, reviewer access, reproducible
  fixture data, or rollback ownership is incomplete.

## Promotion order

1. Merge the runtime and domain-verification changes to `sandbox` and wait for a
   healthy deployment.
2. Apply the canonical `implement-code-change` workflow in sandbox. Verify its
   immutable version, `repository` and `issue-id` inputs, exact-revision gate,
   two task bounds, and no-merge/no-deploy boundary.
3. Merge `aictrl-dev/skills#4`, create a new semantic release, and verify the
   published `CHECKSUMS.sha256` against the release commit.
4. Update `public-skills.lock.json` to that exact commit and checksum-manifest
   digest. Run `npm run assemble:public`; do not hand-edit generated skill files.
5. Run all package verification below, then merge the plugin PR.
6. Promote the sandbox runtime batch to production and repeat the health, OAuth,
   MCP catalog, schema, annotation, and connected-workflow checks against the
   canonical `https://aictrl.dev/mcp` resource.
7. Publish and verify the public Git, npm, and portal artifacts in the vendor
   sections below.

Do not reorder steps 3 and 4. The skills v1.0.0 connected instructions use the
obsolete `issue_id` key; the canonical workflow requires the exact `issue-id`
key published by `aictrl-dev/skills#4`.

## Package verification

Run from a clean checkout of the exact plugin release commit:

```bash
npm ci
npm run build
npm test
npm run validate:public
npm run smoke:claude-public
npm run smoke:codex-public
npm run smoke:opencode-public
npm pack ./opencode --dry-run --json
```

Record the commit, skill source commit, checksum-manifest digest, package
versions, command results, client versions, and UTC time. The packed OpenCode
artifact must contain only the installer, README, license, skills manifest, and
the eight generated skills.

## Claude Code publication

1. Publish the final plugin commit and release notes in the public Git
   repository.
2. From a clean Claude Code client, add `aictrl-dev/aictrl-plugin`, install
   `aictrl@aictrl-public`, and start a new session.
3. Complete one local skill without authentication.
4. Complete native OAuth and the connected `implement-code-change` test through
   result retrieval.
5. Repeat install, upgrade, uninstall, and marketplace removal while confirming
   unrelated client state is preserved.

Claude publication has no separate third-party directory gate unless Anthropic
publishes one. The public Git marketplace and clean external smoke test are the
release evidence.

## OpenCode npm publication

### First package publication

`@aictrl/opencode` must exist before npm trusted publishing can be configured.
For the first beta only, an authenticated `@aictrl` npm owner publishes the
verified package from the merged release commit:

```bash
npm whoami
npm publish ./opencode --access public --tag beta
```

The owner must satisfy npm's current 2FA policy. Do not add a long-lived npm
token to the repository. After the package exists, configure its trusted
publisher for GitHub organization `aictrl-dev`, repository `aictrl-plugin`,
workflow `publish.yml`, environment `release`, and the `npm publish` action.

### Later beta publications

Create a GitHub release whose tag exactly matches
`public-v<opencode/package.json version>`. The release workflow validates the
package and production OAuth boundary, then publishes `./opencode` with the
`beta` dist-tag through npm OIDC.

For every npm publication, verify from an unauthenticated clean environment:

```bash
npm view @aictrl/opencode version dist-tags --json
npx @aictrl/opencode --project .
opencode mcp list
npx @aictrl/opencode --project . --uninstall
```

Only after the package is publicly installable, submit the one-row AICtrl
OpenCode Ecosystem change using `submission/opencode/ecosystem.md`. The current
upstream policy requires an issue before the PR. Keep its issue, PR, merge
commit, and listing smoke test in the release evidence.

## Codex and ChatGPT publication

1. Confirm the OpenAI organization has a verified developer or business
   identity and the submitter has Apps Management write access.
2. Enter the canonical Codex MCP resource URL from `plugins/aictrl/.mcp.json`
   in the plugin portal: `https://aictrl.dev/mcp`.
3. Store the portal-provided domain token as a new production secret version.
   Verify that `/.well-known/openai-apps-challenge` returns only the exact token
   as plain text, then remove the token from local shell history and evidence.
4. Scan tools and confirm exactly six tools with truthful schemas,
   `readOnlyHint`, `openWorldHint`, and `destructiveHint` annotations.
5. Upload the final generated skill tree, listing assets, starter prompts,
   release notes, and exactly five positive plus three negative reviewer cases.
   Every positive case must name its real fixture and account requirements; do
   not submit placeholder repository, issue, pull-request, or run identifiers.
6. Verify the reviewer account works without MFA, email confirmation, SMS, or
   private-network access. Select only supported regions and complete policy
   attestations after the final review.
7. Submit for review, answer findings against the deployed version, and record
   approval. Publication still requires the release owner to select Publish in
   the portal after approval.
8. Install from the universal plugin directory in a clean Codex/ChatGPT client;
   complete one local skill and one connected workflow before closing the vendor
   issue.

## Connected beta evidence

The launch proof must use a dedicated, authorized public fixture repository, a
disposable fixture issue, and the no-MFA reviewer demo account. Do not run the
submission cases against a production backlog issue. Provision and rehearse the
resources using `submission/codex/reviewer-fixture.md`. Record:

- referral source, agent platform, skill and plugin versions, without source or
  prompt content;
- OAuth start, completion, and negative/cancel paths;
- the resolved workflow version and idempotent start;
- a pause at the exact base revision and an approval using the unchanged
  expected revision;
- terminal status, pull-request URL, exact head revision, redacted evidence,
  checks, reported cost, and errors;
- elapsed time, with the beta median under five minutes.

The workflow must stop at a merge-ready pull request. Never use launch evidence
that merged or deployed automatically.

## Rollback and credential rotation

If a public artifact or connected path is unsafe:

1. Stop new connected starts at the runtime or policy boundary while preserving
   run and approval audit history.
2. Roll back the runtime to the last verified revision and repeat health and
   authorization smoke tests.
3. Publish a corrected Git package version. Do not rewrite an immutable skills
   tag or checksum manifest.
4. Deprecate an affected npm version and move the `beta` dist-tag to the last
   safe version. Use npm unpublish only when its current policy permits it and
   the incident owner explicitly approves the irreversible action.
5. Unpublish or disable the Codex plugin in the portal when the listing itself
   is unsafe; notify reviewers when an in-review version is withdrawn.
6. Rotate any affected OAuth client, npm publisher, GitHub release, reviewer,
   domain-challenge, or runtime secret. Revoke the old credential before
   restoring publication.
7. Publish an incident note through the support/status channel and link the
   replacement release.

## Post-publication monitoring

For the first 24 hours, the release owner monitors production health, OAuth
completion/failure, workflow starts and terminal states, authorization denials,
latency, cost, and support reports. Re-run the public install and connected smoke
test after any runtime, skill, package, listing, or credential change.
