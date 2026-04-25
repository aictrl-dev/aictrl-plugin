export interface FetchWithRetryOptions {
  /** Base delay in ms before first retry (doubles on each attempt). Default 250. */
  delayMs?: number;
  /** Maximum number of retry attempts. Default 3. */
  maxRetries?: number;
  /** Human-readable label for error messages (e.g. "SKILL.md for kg-classify"). Avoids leaking the URL, which contains the API key. */
  label?: string;
}

// Cap Retry-After to keep retry latency sane even if a misconfigured or
// adversarial server returns a huge value (e.g. 3600s).
const MAX_RETRY_AFTER_MS = 30_000;

// Jitter spreads synchronized retries from concurrent requests in the same
// batch (which would otherwise re-hit the rate limiter in lock-step).
function withJitter(ms: number): number {
  return ms * (0.8 + Math.random() * 0.4);
}

/**
 * Wraps `fetch` with exponential-backoff retry on 429 and 5xx responses, and
 * on network-level errors (DNS resolution, connection reset, socket timeout —
 * `fetch` throws a `TypeError` in these cases). Honors the `Retry-After`
 * response header when present (numeric seconds; HTTP-date format is not
 * parsed and falls back to the default backoff). Retry-After is capped at
 * MAX_RETRY_AFTER_MS to keep latency bounded.
 *
 * Non-retryable errors (e.g. 404) are thrown immediately after the first
 * attempt. Error messages use `label` (or fall back to the request method)
 * rather than the raw URL — the URL contains the caller's API key.
 */
export async function fetchWithRetry(
  url: string,
  options: FetchWithRetryOptions & RequestInit = {},
): Promise<Response> {
  const { delayMs = 250, maxRetries = 3, label, ...fetchInit } = options;
  const what = label ?? 'request';

  let attempt = 0;

  while (true) {
    let response: Response;
    let networkError: unknown = null;
    try {
      response = await fetch(url, fetchInit);
    } catch (err) {
      networkError = err;
      response = undefined as unknown as Response;
    }

    if (networkError !== null) {
      // Network-level error (TypeError from fetch) — retry with backoff
      if (attempt >= maxRetries) {
        throw new Error(`Network error fetching ${what} (after ${attempt} retries): ${(networkError as Error).message}`);
      }
      await new Promise<void>(resolve => setTimeout(resolve, withJitter(delayMs * Math.pow(4, attempt))));
      attempt++;
      continue;
    }

    const shouldRetry = !response.ok && (response.status === 429 || response.status >= 500);

    if (response.ok || !shouldRetry) {
      if (!response.ok) {
        throw new Error(`HTTP ${response.status} fetching ${what}`);
      }
      return response;
    }

    if (attempt >= maxRetries) {
      throw new Error(`HTTP ${response.status} fetching ${what} (after ${attempt} retries)`);
    }

    // Determine delay: honour Retry-After header if present (numeric seconds only)
    const retryAfter = response.headers.get('Retry-After');
    let waitMs: number;
    if (retryAfter !== null) {
      const parsed = parseFloat(retryAfter);
      waitMs = isNaN(parsed)
        ? delayMs * Math.pow(4, attempt)
        : Math.min(parsed * 1000, MAX_RETRY_AFTER_MS);
    } else {
      // Exponential backoff: 250ms, 1000ms, 4000ms
      waitMs = delayMs * Math.pow(4, attempt);
    }

    await new Promise<void>(resolve => setTimeout(resolve, withJitter(waitMs)));
    attempt++;
  }
}

export interface MarketplaceSkill {
  name: string;
  description: string;
  version: string;
  tags: string[];
}

export interface SkillFile {
  path: string;
  content: string;
}

export interface SkillContent {
  markdown: string;
  files: SkillFile[];
}

interface MarketplaceResponse {
  name: string;
  plugins: Array<{
    name: string;
    description: string;
    version: string;
    tags: string[];
  }>;
}

interface PluginJson {
  name: string;
  files?: Array<{ path: string }>;
}

export async function fetchMarketplace(
  baseUrl: string,
  orgSlug: string,
  apiKey: string,
): Promise<MarketplaceSkill[]> {
  const url = `${baseUrl}/${orgSlug}/${apiKey}/skills.git/.claude-plugin/marketplace.json`;
  const response = await fetch(url);

  if (response.status === 401) {
    throw new Error('Invalid API key or org slug');
  }

  if (!response.ok) {
    throw new Error(`Failed to fetch marketplace (status ${response.status})`);
  }

  const data = await response.json() as MarketplaceResponse;

  if (!Array.isArray(data.plugins)) {
    throw new Error('Invalid marketplace response: missing plugins array');
  }

  const mcpPrefix = `aictrl-`;
  return data.plugins
    .filter(p => !(p.tags?.includes('mcp') && p.name.startsWith(mcpPrefix)))
    .map(p => ({
      name: p.name,
      description: p.description,
      version: p.version || '1.0.0',
      tags: p.tags || [],
    }));
}

export async function fetchSkillContent(
  baseUrl: string,
  orgSlug: string,
  apiKey: string,
  skill: MarketplaceSkill,
): Promise<SkillContent> {
  const pluginBase = `${baseUrl}/${orgSlug}/${apiKey}/skills.git/plugins/${skill.name}`;

  // Fetch SKILL.md
  const mdResponse = await fetchWithRetry(`${pluginBase}/SKILL.md`, {
    label: `SKILL.md for ${skill.name}`,
  });
  const markdown = await mdResponse.text();

  // Fetch plugin.json to check for supporting files
  let pjResponse: Response;
  try {
    pjResponse = await fetchWithRetry(`${pluginBase}/.claude-plugin/plugin.json`, {
      label: `plugin.json for ${skill.name}`,
    });
  } catch {
    return { markdown, files: [] };
  }

  const pluginJson = await pjResponse.json() as PluginJson;
  if (!pluginJson.files || pluginJson.files.length === 0) {
    return { markdown, files: [] };
  }

  // Fetch supporting files (skip SKILL.md itself)
  const supportingFiles = pluginJson.files.filter(f => f.path !== 'SKILL.md');
  const files: SkillFile[] = [];

  for (const file of supportingFiles) {
    try {
      const fileResponse = await fetchWithRetry(`${pluginBase}/${file.path}`, {
        label: `${file.path} for ${skill.name}`,
      });
      files.push({
        path: file.path,
        content: await fileResponse.text(),
      });
    } catch {
      // Skip files that fail even after retries
    }
  }

  return { markdown, files };
}
