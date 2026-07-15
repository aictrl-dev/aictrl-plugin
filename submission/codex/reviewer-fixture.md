# Codex reviewer fixture

Provision this fixture before replacing the placeholders in `test-cases.md` or
submitting the plugin. Do not use an AICtrl production backlog repository as a
review fixture.

The deterministic repository seed is in `fixture-template/repository/`, and the
disposable issue body is in `fixture-template/issue.md`. Keep them synchronized
with the final provisioned resources.

## Provisioned GitHub fixture

- Repository: [`aictrl-dev/aictrl-plugin-reviewer-fixture`](https://github.com/aictrl-dev/aictrl-plugin-reviewer-fixture)
- Baseline revision: `09b5d36ae163a39fe6b3f56ce347a8cb026afd2c`
- Fixture issue: [`aictrl-dev/aictrl-plugin-reviewer-fixture#1`](https://github.com/aictrl-dev/aictrl-plugin-reviewer-fixture/issues/1)
- Repository-owned workflow: [`aictrl-dev/aictrl-plugin-reviewer-fixture#2`](https://github.com/aictrl-dev/aictrl-plugin-reviewer-fixture/pull/2),
  schema/DAG-valid at `77dc71a2e0cd857e09c0fe56055eb0db95ff4961`
  and pending the required independent approval and merge.
- Baseline verification: dependency-free `npm test` passes two tests.
- Default branch: `main`, protected with one approval, stale-review dismissal,
  last-push approval, conversation resolution, and admin enforcement. Force
  pushes, branch deletion, merge commits, and automatic merge are disabled.

The AICtrl repository connection and no-MFA portal demo account remain pending.
Do not replace the connected test-case placeholders or submit the reviewer pack
until those resources are provisioned and the clean-client rehearsal passes.

## Required external resources

- [x] A dedicated public GitHub repository owned by `aictrl-dev`.
- [x] One small, deterministic project with a fast test command and no credentials,
  customer data, private dependencies, or organization-only instructions.
- [x] One open, disposable issue that requests a bounded code change with explicit
  acceptance criteria. The issue must be safe to run repeatedly.
- [x] Default-branch rules that reject force-pushes and direct workflow writes while
  still allowing the GitHub integration to create feature branches and pull
  requests. The connected workflow must not receive merge permission.
- [ ] The repository-owned `implement-code-change` workflow is independently
  reviewed and merged through the protected default branch.
- [ ] An active AICtrl repository connection for the reviewer organization and only
  the fixture repository.
- [ ] A portal demo account that can complete OAuth and the connected cases without
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

The release owner approved and provisioned the repository from the reviewed
`fixture-template/repository/` tree and created its fixture issue from
`fixture-template/issue.md`.

Run these read-only checks after the owner provisions the resources:

```bash
gh repo view aictrl-dev/aictrl-plugin-reviewer-fixture \
  --json nameWithOwner,visibility,defaultBranchRef,url
gh issue view 1 --repo aictrl-dev/aictrl-plugin-reviewer-fixture \
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
