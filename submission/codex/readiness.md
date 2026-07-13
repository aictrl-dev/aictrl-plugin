# Codex submission readiness

## Package

- [x] `.codex-plugin/plugin.json` passes local ingestion validation.
- [x] Marketplace policy includes installation, authentication, and category.
- [x] Eight skills are byte-pinned and checksum-verified.
- [x] Website, support, privacy, and terms URLs return HTTP 200.
- [x] Starter prompts are limited to three.
- [x] Reviewer pack contains exactly five positive and three negative cases.
- [ ] Final logo and screenshots are approved for the public listing.

## MCP and OAuth

- [ ] `https://aictrl.dev/mcp/workflows` is deployed and publicly reachable.
- [ ] Tool scan returns exactly the six workflow lifecycle tools.
- [ ] Schemas and all three annotations match deployed behavior.
- [ ] Dynamic registration, PKCE, client/redirect binding, replay, refresh, and
      cancellation negative tests pass from a clean Codex client.
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
