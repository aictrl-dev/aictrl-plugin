export function credentialResolverSnippet(baseUrl: string): string {
  return `# Resolve credentials from aictrl config files
command -v jq >/dev/null 2>&1 || exit 0

AICTRL_PROJECT_CONFIG=".aictrl.json"
AICTRL_CREDENTIALS="$HOME/.aictrl/credentials.json"

# Find project root by walking up directories
find_project_root() {
  local dir="$PWD"
  while [ "$dir" != "/" ]; do
    if [ -f "$dir/$AICTRL_PROJECT_CONFIG" ]; then
      echo "$dir"
      return 0
    fi
    dir="$(dirname "$dir")"
  done
  return 1
}

PROJECT_ROOT=$(find_project_root) || exit 0
ORG_SLUG=$(jq -r '.orgSlug // empty' "$PROJECT_ROOT/$AICTRL_PROJECT_CONFIG" 2>/dev/null)
[ -z "$ORG_SLUG" ] && exit 0

AICTRL_API_KEY=$(jq -r ".orgs[\\"$ORG_SLUG\\"].apiKey // empty" "$AICTRL_CREDENTIALS" 2>/dev/null)
[ -z "$AICTRL_API_KEY" ] && exit 0

AICTRL_REPO_URL=$(git -C "$PROJECT_ROOT" remote get-url origin 2>/dev/null || echo "")
AICTRL_BASE_URL="${baseUrl}"`;
}

export function telemetrySendSnippet(): string {
  return `# Send telemetry (fire-and-forget, never blocks)
send_telemetry() {
  local SKILL="$1"
  local SOURCE="$2"

  MACHINE_ID=$(hostname | sha256sum 2>/dev/null | cut -d' ' -f1 | head -c 16 || echo "unknown")
  TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%S.000Z")

  PAYLOAD=$(jq -n \\
    --arg sn "$SKILL" \\
    --arg src "$SOURCE" \\
    --arg repo "$AICTRL_REPO_URL" \\
    --arg mid "$MACHINE_ID" \\
    --arg ts "$TIMESTAMP" \\
    '{skillName: $sn, source: $src, repoUrl: $repo, machineId: $mid, timestamp: $ts}')

  curl -s -X POST \\
    "$AICTRL_BASE_URL/api/telemetry/skill-usage" \\
    -H "Content-Type: application/json" \\
    -H "X-API-Key: $AICTRL_API_KEY" \\
    -d "$PAYLOAD" \\
    --connect-timeout 3 \\
    --max-time 5 \\
    > /dev/null 2>&1 || true
}`;
}
