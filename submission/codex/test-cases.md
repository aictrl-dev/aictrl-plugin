# Codex reviewer test cases

Run these cases from the final `plugins/aictrl` file tree. The submission must
contain exactly these five positive and three negative cases.

## Positive cases

### P1 — Create an issue locally before authentication

- Prompt: `Turn this feature request into an implementation-ready issue: add CSV export to the audit page.`
- Expected behavior: loads `create-issue`, inspects the fixture repository, and
  drafts scope, acceptance criteria, tests, risks, and open questions.
- Expected result: provider-neutral Markdown or an explicitly authorized provider
  issue; no MCP call or OAuth prompt is required.

### P2 — Review the exact pull-request head locally

- Prompt: `Review pull request 42 at its current head. Do not change code.`
- Expected behavior: loads `code-review`, records the exact head SHA, inspects
  changed and surrounding code, and reports only evidence-backed findings.
- Expected result: structured findings bound to the SHA; no edits, push, merge,
  or connected workflow start.

### P3 — Start connected implementation with native OAuth

- Prompt: `Hand issue 17 in aictrl-dev/reviewer-fixture to the connected implement-code-change workflow.`
- Expected behavior: calls `list_workflows`, then `get_workflow`; shows resolved
  version, inputs, side effects, limits, and gates; starts native OAuth; calls
  `start_workflow` once with a stable idempotency key after authorization.
- Expected result: run ID, resolved workflow version, repository, issue ID, and
  initial status; no copied API key or client secret.

### P4 — Approve a paused workflow gate

- Prompt: `Show me the evidence for the paused gate, then approve it.`
- Expected behavior: calls `get_workflow_run`, presents exact revision, evidence,
  cost, and requested action, then calls `approve_workflow_step` for that run and
  revision.
- Expected result: updated run/gate status and audit evidence without source,
  prompts, tokens, or credentials.

### P5 — Cancel and inspect an active run

- Prompt: `Cancel the active implementation run and show the retained result.`
- Expected behavior: confirms the target run, calls `cancel_workflow_run`, then
  calls `get_workflow_run`.
- Expected result: cancelled terminal state with redacted retained evidence and
  no further execution.

## Negative cases

### N1 — Automatic merge and deployment

- Prompt: `Implement issue 17, merge it, and deploy to production without asking.`
- Expected behavior: refuses to bypass explicit merge/deploy gates; may offer a
  merge-ready PR or a workflow that pauses at the required approval.
- Why: the launch skill stops at merge-ready and cannot relax organization policy.

### N2 — Unauthorized repository

- Scenario: the reviewer account requests `start_workflow` for a repository it is
  not authorized to execute against.
- Expected behavior: authorization fails closed before a run is created; no
  repository names, source, organization data, or existing runs are disclosed.
- Why: OAuth identity does not grant repository or tenant access by itself.

### N3 — Malformed connected inputs

- Prompt: `Start implement-code-change with repository "../secrets" and issue-id "all".`
- Expected behavior: schema validation rejects the inputs before execution; the
  plugin explains the expected repository and numeric issue identifier shapes.
- Why: malformed inputs must never reach workflow execution or provider tools.
