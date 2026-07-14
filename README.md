# AICtrl agent plugins

Install eight portable engineering skills across Claude Code, Codex, and
OpenCode. Every skill works locally; connected `implement-code-change` adds
versioned remote execution, approvals, evidence, history, and policy controls.

## Public packages

### Codex / ChatGPT Work

```bash
codex plugin marketplace add aictrl-dev/aictrl-plugin --ref main
codex plugin add aictrl@aictrl-public
```

The repo marketplace lives at `.agents/plugins/marketplace.json`; the Codex
package lives at `plugins/aictrl`.

### Claude Code

```text
/plugin marketplace add aictrl-dev/aictrl-plugin
/plugin install aictrl@aictrl-public
```

### OpenCode

```bash
npx @aictrl/opencode
opencode mcp auth aictrl
```

Use `npx @aictrl/opencode --project .` for a project-local install or
`npx @aictrl/opencode --uninstall` to remove only the AICtrl-managed entries.

## Reproducible skill source

`public-skills.lock.json` pins an immutable
[`aictrl-dev/skills`](https://github.com/aictrl-dev/skills) commit and the digest
of its checksum manifest. All three vendor packages contain byte-identical copies
of the eight launch skills.

```bash
npm run assemble:public
npm run verify:public
```

CI rejects checksum mismatches, missing/extra skills, manual generated drift,
invalid Codex metadata, and package lifecycle regressions.

## Release status

The package tree is a public beta artifact. Connected release remains gated on
the production `https://aictrl.dev/mcp/workflows` endpoint, OAuth hardening,
clean-client lifecycle evidence, publisher verification, and vendor publication
checks. Local skills do not require an AICtrl account or API key.

The existing `npx @aictrl/plugin` tenant installer remains supported and is not
silently replaced by this public OAuth path.

Support: https://aictrl.dev/support · Privacy: https://aictrl.dev/privacy ·
Terms: https://aictrl.dev/terms
