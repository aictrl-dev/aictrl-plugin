# @aictrl/opencode

Install eight portable AICtrl engineering skills plus the remote workflow MCP
configuration for OpenCode.

```bash
npx @aictrl/opencode
opencode mcp auth aictrl
```

The skills work locally without an AICtrl account. OAuth is requested only when
you use the connected `implement-code-change` workflow.

The package is assembled from the pinned, checksummed
[`aictrl-dev/skills`](https://github.com/aictrl-dev/skills) release; the canonical
skills remain free to install directly on any supported coding agent.

Use `npx @aictrl/opencode --project .` for project-local installation or
`npx @aictrl/opencode --uninstall` to remove only AICtrl-managed skills and MCP
configuration.

Support: https://aictrl.dev/support · Privacy: https://aictrl.dev/privacy ·
Terms: https://aictrl.dev/terms
