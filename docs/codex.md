# Codex Support

`@aictrl/plugin --editors codex` installs a local Codex plugin into the personal marketplace and
adds an aictrl MCP server to Codex config.

The MCP entry is written to `~/.codex/config.toml` as:

```toml
[mcp_servers.aictrl-<orgSlug>]
url = "https://aictrl.dev/<orgSlug>/mcp"
bearer_token_env_var = "AICTRL_API_KEY"
```

The installer intentionally uses `bearer_token_env_var` instead of writing the API key into Codex
config. Start Codex with `AICTRL_API_KEY` in the environment so the MCP server can authenticate.

## Telemetry Limitation

Codex does not currently expose a stable skill-invocation hook surface that this package can use to
emit a reliable `source: "codex"` skill-usage event. The Codex installer therefore does not install
or claim skill-usage telemetry for Codex. Skills and MCP are installed; telemetry remains disabled
until Codex exposes a supported invocation hook or plugin telemetry surface.
