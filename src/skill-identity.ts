import { SKILL_NAME_REGEX } from './config.js';

// A GitHub identifier: lowercase alphanumeric + hyphens, must start/end with alphanumeric.
// Similar to SKILL_NAME_REGEX but with an extra `|^[a-z0-9]$` branch to allow
// single-character identifiers — GitHub permits 1-char org/repo names, whereas
// SKILL_NAME_REGEX requires length >= 2.
const GH_IDENT_REGEX = /^[a-z0-9][a-z0-9-]{0,98}[a-z0-9]$|^[a-z0-9]$/;

const SEPARATOR = '__';

export interface ParsedPluginId {
  owner: string;
  repo: string;
  bareName: string;
}

/**
 * Parse a qualified plugin ID of the form `{owner}__{repo}__{bareName}`.
 *
 * Returns `null` for a bare (unqualified) name.
 * Throws for names that contain `__` but don't conform to the 3-part shape.
 */
export function parsePluginId(id: string): ParsedPluginId | null {
  if (!id.includes(SEPARATOR)) {
    // Bare name — not qualified
    return null;
  }

  const parts = id.split(SEPARATOR);

  if (parts.length !== 3) {
    throw new Error(
      `Malformed qualified skill ID "${id}": expected format owner__repo__name (got ${parts.length} parts)`,
    );
  }

  const [owner, repo, bareName] = parts;

  if (!owner || !GH_IDENT_REGEX.test(owner)) {
    throw new Error(
      `Invalid qualified skill ID "${id}": owner segment "${owner}" is not a valid GitHub identifier`,
    );
  }

  if (!repo || !GH_IDENT_REGEX.test(repo)) {
    throw new Error(
      `Invalid qualified skill ID "${id}": repo segment "${repo}" is not a valid GitHub identifier`,
    );
  }

  if (!bareName || !SKILL_NAME_REGEX.test(bareName)) {
    throw new Error(
      `Invalid qualified skill ID "${id}": bare name segment "${bareName}" is not a valid skill name`,
    );
  }

  return { owner, repo, bareName };
}

/**
 * Resolve the folder name to use on disk for a skill ID.
 *
 * - Qualified IDs (`owner__repo__name`) → returns bare name
 * - Bare IDs (`name`) → returns as-is
 * - Malformed IDs (contain `__` but wrong shape) → throws
 */
export function resolveSkillFolderName(id: string): string {
  const parsed = parsePluginId(id);
  return parsed !== null ? parsed.bareName : id;
}
