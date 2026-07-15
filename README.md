# AICtrl legacy tenant installer

> The public AICtrl skills and agent plugin now live in the canonical
> [`aictrl-dev/skills`](https://github.com/aictrl-dev/skills) repository. This
> repository no longer owns or generates public skill packages.

## Public skills and plugin

Install all eleven portable engineering skills directly:

```bash
npx skills add aictrl-dev/skills
```

Claude Code and Codex install the repository-root `aictrl` plugin from
`aictrl-dev/skills`. OpenCode installs `@aictrl/opencode`. All three consume the
same root `skills/` tree and configure one OAuth MCP server named `aictrl` at
`https://aictrl.dev/mcp`.

See the [canonical repository](https://github.com/aictrl-dev/skills) for current
install commands, release checksums, submission status, and the public release
runbook.

## Existing tenant installer

`npx @aictrl/plugin` remains supported for existing organization-scoped setup.
It accepts an AICtrl organization and API key, then installs tenant-managed
skills, telemetry, and MCP configuration for the selected editors. It is a
legacy administration path, not the public acquisition package, and must not
gain copied public skill trees.

## Development

```bash
npm ci
npm run build
npm test
```

CI continues to exercise the legacy installer against production and verifies
the authenticated public MCP catalog. Public package lifecycle coverage belongs
to `aictrl-dev/skills`.

Support: https://aictrl.dev/support · Privacy: https://aictrl.dev/privacy ·
Terms: https://aictrl.dev/terms
