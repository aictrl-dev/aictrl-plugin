# Codex reviewer fixture

Provision this fixture before replacing the placeholders in `test-cases.md` or
submitting the plugin. Do not use an AICtrl production backlog repository as a
review fixture.

## Required external resources

- A dedicated public GitHub repository owned by `aictrl-dev`. A descriptive
  name such as `aictrl-plugin-reviewer-fixture` is recommended, but the release
  owner must approve the final repository name before creation.
- One small, deterministic project with a fast test command and no credentials,
  customer data, private dependencies, or organization-only instructions.
- One open, disposable issue that requests a bounded code change with explicit
  acceptance criteria. The issue must be safe to run repeatedly.
- An active AICtrl repository connection for the reviewer organization and only
  the fixture repository.
- A portal demo account that can complete OAuth and the connected cases without
  MFA, email confirmation, SMS, private-network access, or support intervention.

Never commit the demo password, recovery code, OAuth token, GitHub installation
token, domain challenge, or reviewer session to this repository or release
evidence.

## Repeatability contract

Before every reviewer run:

1. Restore the fixture default branch to the documented baseline through a
   normal reviewed change; never rewrite public release history.
2. Close or label prior generated pull requests so the next result is
   unambiguous. Preserve old runs and pull requests as audit evidence.
3. Confirm the fixture issue is open and still matches the baseline.
4. Confirm the reviewer account can see only the intended AICtrl organization
   and repository connection.
5. Record the default-branch commit SHA and UTC start time outside the prompt.

The connected workflow must validate that exact revision, pause before any
write, and create or update one merge-ready pull request without merging or
deploying. P4 uses the paused run from P3. P5 uses a separate fresh run so the
cancellation case cannot invalidate the approval case.

## Provisioning verification

Run these read-only checks after the owner provisions the resources:

```bash
gh repo view <fixture-owner>/<fixture-repository> \
  --json nameWithOwner,visibility,defaultBranchRef,url
gh issue view <fixture-issue> --repo <fixture-owner>/<fixture-repository> \
  --json number,title,state,url
```

Then complete a clean-client rehearsal and record only non-secret evidence:

- final repository and issue URLs;
- package, skill, and workflow versions;
- OAuth start/completion/cancellation outcomes;
- paused and approved exact revisions;
- terminal run status and generated pull-request URL;
- redacted evidence, checks, reported cost, and elapsed time.

Replace every placeholder in `test-cases.md` only after this rehearsal passes.

