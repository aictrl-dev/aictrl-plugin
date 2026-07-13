# @aictrl/opencode

Install eight portable AICtrl engineering skills plus the remote workflow MCP
configuration for OpenCode.

```bash
npx @aictrl/opencode
opencode mcp auth aictrl
```

The skills work locally without an AICtrl account. OAuth is requested only when
you use the connected `implement-code-change` workflow.

Use `npx @aictrl/opencode --project .` for project-local installation or
`npx @aictrl/opencode --uninstall` to remove only AICtrl-managed skills and MCP
configuration.
