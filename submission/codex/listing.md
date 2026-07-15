# Codex plugin listing

Use these values in the OpenAI plugin submission portal. They mirror the
published package manifest so the portal listing and install surface do not
drift. Do not submit while any owner-only item below remains unresolved.

## Info

| Portal field | Value |
| --- | --- |
| Plugin name | `AICtrl` |
| Short description | `Engineering skills and controlled workflows` |
| Long description | `Use eight portable engineering skills locally, then hand implementation work to versioned AICtrl workflows with approvals, evidence, history, and policy controls.` |
| Category | `Productivity` |
| Developer name | `aictrl.dev` |
| Website | `https://aictrl.dev` |
| Support | `https://aictrl.dev/support` |
| Privacy policy | `https://aictrl.dev/privacy` |
| Terms of service | `https://aictrl.dev/terms` |
| Brand color | `#4c6ef5` |
| Logo | `./assets/icon.svg` (source: `plugins/aictrl/assets/icon.svg`) |

The bundled logo is the canonical 64-unit indigo hex mark from the AICtrl
brand system. It has no script, external resource, embedded text, filter,
shadow, or background-dependent color. The release owner must still approve
the portal-rendered production preview before submission.

Select the verified `aictrl.dev` business identity in the portal. Stop if that
identity is absent, does not match the public URLs above, or the submitter lacks
Apps Management write access.

## MCP

| Portal field | Value |
| --- | --- |
| Production MCP URL | `https://aictrl.dev/mcp` |
| Authentication | OAuth 2.1 |
| Custom UI | None |
| Browser fetch domains | None |
| Content-security-policy allowlists | Empty |

The package contains no `.app.json`, web component, iframe, browser script, or
browser-side fetch. Do not add `aictrl.dev` or unrelated analytics domains to
the CSP merely because the MCP server or website uses them. The MCP URL and
domain challenge are separate portal fields. Stop if the portal scan discovers
a browser-fetch dependency; document that dependency and add only its exact
origin before continuing.

After the portal provides the domain challenge, follow
`docs/public-release-runbook.md`: temporarily configure the exact value on the
production Cloud Run service, verify the well-known endpoint, and never place
the value in Git, CI, Terraform, Secret Manager, shell history, or release
evidence.

Scan the production server and require exactly these tools:

1. `list_workflows`
2. `get_workflow`
3. `start_workflow`
4. `get_workflow_run`
5. `approve_workflow_step`
6. `cancel_workflow_run`

The protected-key CI scan is the source of truth for tool schemas, safety
annotations, and non-empty descriptions.

## Skills and prompts

Upload the final `plugins/aictrl/skills/` tree from the release commit. Use
exactly these three starter prompts from the manifest without adding portal-only
variants:

1. `Turn this request into an implementation-ready issue.`
2. `Implement this issue and prepare a merge-ready pull request.`
3. `Review this pull request at its current head revision.`

Upload the five positive and three negative cases from `test-cases.md` only
after every connected positive case contains the rehearsed fixture, account,
and run data described in `reviewer-fixture.md`.

## Global and submit

The release owner selects only countries or regions covered by current product,
support, privacy, and legal commitments. Record that decision in
`readiness.md`; do not infer availability from website reachability.

Use `release-notes.md` for the initial-submission notes. Complete policy
attestations only after the final listing, server scan, skills, prompts, tests,
demo account, and availability decision are all accurate. Submission starts
review; after approval, the owner must explicitly publish and complete the
universal-directory smoke test.
