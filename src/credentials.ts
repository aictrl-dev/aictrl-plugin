import { readFile, writeFile, mkdir, chmod } from 'fs/promises';
import { dirname } from 'path';

export interface Credentials {
  orgs: Record<string, { apiKey: string }>;
}

export interface ProjectConfig {
  orgSlug: string;
}

export async function readCredentials(filePath: string): Promise<Credentials> {
  try {
    const content = await readFile(filePath, 'utf-8');
    return JSON.parse(content) as Credentials;
  } catch {
    return { orgs: {} };
  }
}

export async function writeOrgCredential(
  filePath: string,
  orgSlug: string,
  apiKey: string,
): Promise<void> {
  await mkdir(dirname(filePath), { recursive: true });
  const existing = await readCredentials(filePath);
  existing.orgs[orgSlug] = { apiKey };
  await writeFile(filePath, JSON.stringify(existing, null, 2) + '\n', 'utf-8');
  await chmod(filePath, 0o600);
}

export async function readProjectConfig(filePath: string): Promise<ProjectConfig | null> {
  try {
    const content = await readFile(filePath, 'utf-8');
    return JSON.parse(content) as ProjectConfig;
  } catch {
    return null;
  }
}

export async function writeProjectConfig(filePath: string, orgSlug: string): Promise<void> {
  await writeFile(filePath, JSON.stringify({ orgSlug }, null, 2) + '\n', 'utf-8');
}
