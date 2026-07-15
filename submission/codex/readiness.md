# Codex submission readiness

## Package

- [x] `.codex-plugin/plugin.json` passes local ingestion validation.
- [x] Marketplace policy includes installation, authentication, and category.
- [x] Codex CLI 0.144.1 completes clean marketplace add, install, repeat install,
      version upgrade, and removal in CI while preserving marketplace configuration.
- [x] Claude Code 2.1.207 completes clean public marketplace add, install, repeat
      install, and removal in CI.
- [x] OpenCode 1.17.20 installs the packed npm artifact, discovers the canonical
      sandbox OAuth boundary, repeats idempotently, and removes only
      AICtrl-managed state after aictrl-dev/aictrl#3904 is deployed.
- [x] Eight skills are byte-pinned and checksum-verified.
- [x] Website, support, privacy, and terms URLs return HTTP 200.
- [x] Starter prompts are limited to three.
- [x] Reviewer pack contains exactly five positive and three negative cases.
- [x] The dedicated public reviewer repository, protected baseline, and bounded
      fixture issue described in `reviewer-fixture.md` are provisioned.
- [ ] Every positive connected reviewer case names the rehearsed no-MFA demo
      account and run data; the AICtrl connection and account remain pending.
- [ ] Final production logo is approved for the public listing. Screenshots are
      optional in the current submission guidance and are not a release gate.

## MCP and OAuth

- [x] The canonical resource URL from `plugins/aictrl/.mcp.json` is deployed and
      publicly reachable.
- [ ] Tool scan returns exactly the six workflow lifecycle tools.
- [ ] Schemas and all three annotations match deployed behavior.
- [ ] Dynamic registration, PKCE, client/redirect binding, replay, refresh, and
      cancellation negative tests pass from a clean Codex client.
- [ ] Portal content-security-policy fields contain only the exact browser-fetch
      domains used by the final package (none for the current no-custom-UI bundle
      unless the portal scan identifies a required domain).
- [ ] Domain challenge is installed at the portal-provided well-known URL.
- [ ] Reviewer account works without MFA, email confirmation, SMS, or private network.

## Publisher and publication

- [ ] Publisher identity is verified in the owning OpenAI organization.
- [ ] Submitter has Apps Management write permission.
- [ ] Availability regions and policy attestations are approved.
- [ ] Plugin is submitted, approved, explicitly published, and smoke-tested from
      the universal plugin directory.

Submission is blocked until every unchecked item is evidenced. Portal submission
alone does not count as publication.
