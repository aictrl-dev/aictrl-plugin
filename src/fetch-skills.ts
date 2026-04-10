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
  const url = `${baseUrl}/${orgSlug}/${apiKey}/marketplace.json`;
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
  const pluginBase = `${baseUrl}/${orgSlug}/${apiKey}/plugins/${skill.name}`;

  // Fetch SKILL.md
  const mdResponse = await fetch(`${pluginBase}/SKILL.md`);
  if (!mdResponse.ok) {
    throw new Error(`Failed to fetch SKILL.md for ${skill.name} (status ${mdResponse.status})`);
  }
  const markdown = await mdResponse.text();

  // Fetch plugin.json to check for supporting files
  const pjResponse = await fetch(`${pluginBase}/.claude-plugin/plugin.json`);
  if (!pjResponse.ok) {
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
    const fileResponse = await fetch(`${pluginBase}/${file.path}`);
    if (fileResponse.ok) {
      files.push({
        path: file.path,
        content: await fileResponse.text(),
      });
    }
  }

  return { markdown, files };
}
