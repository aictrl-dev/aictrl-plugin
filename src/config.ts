import { homedir } from 'os';
import { join } from 'path';

export const DEFAULT_BASE_URL = 'https://aictrl.dev';

export const CREDENTIALS_FILE = join(homedir(), '.aictrl', 'credentials.json');

export const PROJECT_CONFIG_FILE = '.aictrl.json';

export const CLAUDE_PLUGINS_CACHE = join(homedir(), '.claude', 'plugins', 'cache');
export const CLAUDE_SETTINGS_FILE = join(homedir(), '.claude', 'settings.json');

export const OPENCODE_SKILLS_DIR = '.opencode/skills';
export const OPENCODE_HOOKS_DIR = '.opencode/hooks';

export const CURSOR_SKILLS_DIR = '.cursor/skills';
export const CURSOR_HOOKS_DIR = '.cursor/hooks';
export const CURSOR_MCP_FILE = '.cursor/mcp.json';

export const SKILL_NAME_REGEX = /^[a-z0-9][a-z0-9-]{0,98}[a-z0-9]$/;

// 4 concurrent skill fetches: conservative enough to avoid 429s on the marketplace endpoint
// (each skill needs 2–N requests; 4 parallel × ~3 requests = ~12 in-flight max)
export const FETCH_BATCH_SIZE = 4;
