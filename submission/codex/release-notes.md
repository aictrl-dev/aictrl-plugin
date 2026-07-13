# AICtrl 0.1.0 beta — Codex release notes

Initial submission of AICtrl's engineering plugin for Codex and ChatGPT Work.

- Eight portable, local-first skills cover issue creation, bug reporting, spec
  review, implementation, code review, finding judgment, review replies, and
  workflow authoring.
- Connected `implement-code-change` uses native OAuth and a six-tool workflow
  lifecycle with explicit approvals, cancellation, revision evidence, and limits.
- Skill contents are generated from an immutable, checksummed
  `aictrl-dev/skills` source commit.
- The plugin contains no API keys, access tokens, client secrets, repository
  credentials, telemetry hook, or generated secret-bearing file.
