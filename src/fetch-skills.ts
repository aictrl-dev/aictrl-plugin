export interface FetchWithRetryOptions {
  /** Base delay in ms before first retry (doubles on each attempt). Default 250. */
  delayMs?: number;
  /** Maximum number of retry attempts. Default 3. */
  maxRetries?: number;
}

/**
 * Wraps `fetch` with exponential-backoff retry on 429 and 5xx responses.
 * Honors the `Retry-After` response header when present (interpreted as seconds).
 * Non-retryable errors (e.g. 404) are thrown immediately after the first attempt.
 */
export async function fetchWithRetry(
  url: string,
  options: FetchWithRetryOptions & RequestInit = {},
): Promise<Response> {
  const { delayMs = 250, maxRetries = 3, ...fetchInit } = options;

  let attempt = 0;

  while (true) {
    const response = await fetch(url, fetchInit);

    const shouldRetry = !response.ok && (response.status === 429 || response.status >= 500);

    if (response.ok || !shouldRetry) {
      if (!response.ok) {
        throw new Error(`HTTP ${response.status} fetching ${url}`);
      }
      return response;
    }

    if (attempt >= maxRetries) {
      throw new Error(`HTTP ${response.status} fetching ${url} (after ${attempt} retries)`);
    }

    // Determine delay: honour Retry-After header if present
    const retryAfter = response.headers.get('Retry-After');
    let waitMs: number;
    if (retryAfter !== null) {
      const parsed = parseFloat(retryAfter);
      waitMs = isNaN(parsed) ? delayMs * Math.pow(4, attempt) : parsed * 1000;
    } else {
      // Exponential backoff: 250ms, 1000ms, 4000ms
      waitMs = delayMs * Math.pow(4, attempt);
    }

    await new Promise<void>(resolve => setTimeout(resolve, waitMs));
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
  const mdResponse = await fetchWithRetry(`${pluginBase}/SKILL.md`);
  const markdown = await mdResponse.text();

  // Fetch plugin.json to check for supporting files
  let pjResponse: Response;
  try {
    pjResponse = await fetchWithRetry(`${pluginBase}/.claude-plugin/plugin.json`);
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
      const fileResponse = await fetchWithRetry(`${pluginBase}/${file.path}`);
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
