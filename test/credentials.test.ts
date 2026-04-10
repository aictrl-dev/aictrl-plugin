import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, readFile, mkdir, writeFile, stat } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import {
  readCredentials,
  writeOrgCredential,
  readProjectConfig,
  writeProjectConfig,
} from '../src/credentials.js';

describe('credentials', () => {
  let tempDir: string;
  let credentialsFile: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'aictrl-test-'));
    credentialsFile = join(tempDir, 'credentials.json');
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true });
  });

  describe('readCredentials', () => {
    it('returns empty orgs when file does not exist', async () => {
      const creds = await readCredentials(credentialsFile);
      expect(creds).toEqual({ orgs: {} });
    });

    it('throws on corrupt JSON file', async () => {
      await writeFile(credentialsFile, '{not valid json');
      await expect(readCredentials(credentialsFile))
        .rejects.toThrow('Corrupt credentials file');
    });

    it('reads existing credentials', async () => {
      await writeFile(credentialsFile, JSON.stringify({
        orgs: { talentrix: { apiKey: 'sk_live_xxx' } }
      }));
      const creds = await readCredentials(credentialsFile);
      expect(creds.orgs.talentrix.apiKey).toBe('sk_live_xxx');
    });
  });

  describe('writeOrgCredential', () => {
    it('creates file and directory if they do not exist', async () => {
      const nestedFile = join(tempDir, 'nested', 'credentials.json');
      await writeOrgCredential(nestedFile, 'myorg', 'sk_live_abc');
      const creds = JSON.parse(await readFile(nestedFile, 'utf-8'));
      expect(creds.orgs.myorg.apiKey).toBe('sk_live_abc');
    });

    it('preserves existing orgs when adding a new one', async () => {
      await writeFile(credentialsFile, JSON.stringify({
        orgs: { org1: { apiKey: 'key1' } }
      }));
      await writeOrgCredential(credentialsFile, 'org2', 'key2');
      const creds = JSON.parse(await readFile(credentialsFile, 'utf-8'));
      expect(creds.orgs.org1.apiKey).toBe('key1');
      expect(creds.orgs.org2.apiKey).toBe('key2');
    });

    it('overwrites existing org key', async () => {
      await writeFile(credentialsFile, JSON.stringify({
        orgs: { myorg: { apiKey: 'old-key' } }
      }));
      await writeOrgCredential(credentialsFile, 'myorg', 'new-key');
      const creds = JSON.parse(await readFile(credentialsFile, 'utf-8'));
      expect(creds.orgs.myorg.apiKey).toBe('new-key');
    });

    it('sets file permissions to 0600', async () => {
      await writeOrgCredential(credentialsFile, 'myorg', 'sk_live_abc');
      const stats = await stat(credentialsFile);
      expect(stats.mode & 0o777).toBe(0o600);
    });
  });

  describe('readProjectConfig', () => {
    it('returns null when file does not exist', async () => {
      const config = await readProjectConfig(join(tempDir, '.aictrl.json'));
      expect(config).toBeNull();
    });

    it('reads existing project config', async () => {
      const configPath = join(tempDir, '.aictrl.json');
      await writeFile(configPath, JSON.stringify({ orgSlug: 'talentrix' }));
      const config = await readProjectConfig(configPath);
      expect(config?.orgSlug).toBe('talentrix');
    });
  });

  describe('writeProjectConfig', () => {
    it('writes org slug to file', async () => {
      const configPath = join(tempDir, '.aictrl.json');
      await writeProjectConfig(configPath, 'talentrix');
      const config = JSON.parse(await readFile(configPath, 'utf-8'));
      expect(config.orgSlug).toBe('talentrix');
    });
  });
});
