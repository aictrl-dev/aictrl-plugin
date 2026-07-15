# Codex submission readiness

## Package

- [x] `.codex-plugin/plugin.json` passes local ingestion validation.
- [x] Marketplace policy includes installation, authentication, and category.
- [x] Codex CLI 0.144.4 completes clean marketplace add, install, repeat install,
      version upgrade, and removal in CI while preserving marketplace configuration.
- [x] Claude Code 2.1.210 completes clean public marketplace add, install, repeat
      install, and removal in CI.
- [x] OpenCode 1.18.1 installs the packed npm artifact, discovers the canonical
      sandbox OAuth boundary, repeats idempotently, and removes only
      AICtrl-managed state after aictrl-dev/aictrl#3904 is deployed.
- [x] Eight skills are byte-pinned and checksum-verified.
- [x] Website, support, privacy, and terms URLs return HTTP 200.
- [x] Starter prompts are limited to three.
- [x] Reviewer pack contains exactly five positive and three negative cases.
- [x] The dedicated public reviewer repository, protected baseline, and bounded
      fixture issue described in `reviewer-fixture.md` are provisioned.
- [ ] The repository-owned fixture workflow in
      `aictrl-dev/aictrl-plugin-reviewer-fixture#2` is independently reviewed and
      merged through protected `main`.
- [ ] Every positive connected reviewer case names the rehearsed no-MFA demo
      account and run data; the AICtrl connection and account remain pending.
- [x] `listing.md` records the manifest-matched portal copy and canonical AICtrl
      logo asset; the SVG has no script, external resource, embedded text,
      filter, shadow, or background-dependent color.
- [ ] The release owner approves the logo as rendered in the final portal
      preview. Screenshots are optional in the current submission guidance and
      are not a release gate.

## MCP and OAuth

- [x] The canonical resource URL from `plugins/aictrl/.mcp.json` is deployed and
      publicly reachable.
- [x] The protected-key production scan returns exactly the six workflow
      lifecycle tools from `https://aictrl.dev/mcp` (CI run `29420053568`, job
      `87367910414`).
- [x] The same production scan matches the approved input schemas, all three
      safety annotations, and non-empty tool descriptions.
- [ ] Dynamic registration, PKCE, client/redirect binding, replay, refresh, and
      cancellation negative tests pass from a clean Codex client.
- [x] `listing.md` records empty browser content-security-policy allowlists: the
      final package has no `.app.json`, custom UI, iframe, browser script, or
      browser-side fetch.
- [ ] The final portal scan accepts those empty allowlists and does not identify
      a browser-fetch dependency.
- [ ] Domain challenge is installed at the portal-provided well-known URL.
- [ ] Reviewer account works without MFA, email confirmation, SMS, or private network.

## Publisher and publication

- [x] The release owner confirmed on 2026-07-15 that the publisher identity is
      verified in the owning OpenAI organization.
- [x] The release owner confirmed on 2026-07-15 that the submitter has Apps
      Management write permission in that same organization.
- [ ] Availability regions and policy attestations are approved.
- [ ] Plugin is submitted, approved, explicitly published, and smoke-tested from
      the universal plugin directory.

Submission is blocked until every unchecked item is evidenced. Portal submission
alone does not count as publication.
