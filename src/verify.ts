export interface VerifyResult {
  verified: boolean;
  orgId: string;
}

export async function verifyApiKey(baseUrl: string, apiKey: string): Promise<VerifyResult> {
  const url = `${baseUrl}/api/telemetry/skill-usage/verify`;

  const response = await fetch(url, {
    method: 'GET',
    headers: { 'X-API-Key': apiKey },
  });

  if (response.status === 401) {
    throw new Error('Invalid API key');
  }

  if (response.status === 403) {
    throw new Error('API key is not scoped to an organization');
  }

  if (!response.ok) {
    throw new Error(`Verification failed with status ${response.status}`);
  }

  const data = await response.json() as VerifyResult;
  return data;
}
