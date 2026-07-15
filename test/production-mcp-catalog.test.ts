import { describe, expect, it, vi } from 'vitest';
import {
  EXPECTED_CATALOG,
  assertProductionCatalog,
  scanProductionCatalog,
} from '../scripts/smoke-production-mcp.mjs';

function liveShape() {
  return EXPECTED_CATALOG.map((tool) => ({
    ...tool,
    annotations: { ...tool.annotations },
    description: `${tool.name} description`,
    inputSchema: addDescriptions(tool.inputSchema),
  }));
}

function addDescriptions(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(addDescriptions);
  if (!value || typeof value !== 'object') return value;
  return {
    description: 'ignored contract documentation',
    ...Object.fromEntries(
      Object.entries(value).map(([key, child]) => [key, addDescriptions(child)]),
    ),
  };
}

describe('production MCP catalog smoke', () => {
  it('accepts exactly the six approved tools while ignoring descriptions', () => {
    expect(() => assertProductionCatalog(liveShape())).not.toThrow();
  });

  it('rejects extra tools, contract drift, missing descriptions, and custom UI', () => {
    const extra = [...liveShape(), liveShape()[0]];
    expect(() => assertProductionCatalog(extra)).toThrow(/differs/);

    const schemaDrift = liveShape();
    schemaDrift[2].inputSchema.properties.idempotency_key.minLength = 1;
    expect(() => assertProductionCatalog(schemaDrift)).toThrow(/differs/);

    const annotationDrift = liveShape();
    annotationDrift[4].annotations.destructiveHint = false;
    expect(() => assertProductionCatalog(annotationDrift)).toThrow(/differs/);

    const missingDescription = liveShape();
    missingDescription[0].description = '';
    expect(() => assertProductionCatalog(missingDescription)).toThrow(/has no description/);

    const standardUi = liveShape();
    standardUi[0]._meta = { ui: { resourceUri: 'ui://aictrl/workflows.html' } };
    expect(() => assertProductionCatalog(standardUi)).toThrow(/unexpectedly links to custom UI/);

    const compatibilityUi = liveShape();
    compatibilityUi[0]._meta = { 'openai/outputTemplate': 'ui://aictrl/workflows.html' };
    expect(() => assertProductionCatalog(compatibilityUi)).toThrow(/unexpectedly links to custom UI/);
  });

  it('uses API-key authentication and accepts an MCP event-stream response', async () => {
    const tools = liveShape();
    const fetchImpl = vi.fn(async (_url: string, init: RequestInit) => {
      expect(init.headers).toMatchObject({ 'X-API-Key': 'secret-key' });
      expect(String(init.body)).not.toContain('secret-key');
      return new Response(`event: message\ndata: ${JSON.stringify({
        jsonrpc: '2.0', id: 1, result: { tools },
      })}\n\n`, { status: 200, headers: { 'content-type': 'text/event-stream' } });
    });

    await expect(scanProductionCatalog({
      apiKey: 'secret-key',
      fetchImpl: fetchImpl as typeof fetch,
    })).resolves.toHaveLength(6);
    expect(fetchImpl).toHaveBeenCalledOnce();
  });

  it('fails closed when auth is absent or production rejects it', async () => {
    await expect(scanProductionCatalog()).rejects.toThrow(/AICTRL_API_KEY is required/);
    await expect(scanProductionCatalog({
      apiKey: 'invalid',
      fetchImpl: vi.fn(async () => new Response('unauthorized', { status: 401 })) as typeof fetch,
    })).rejects.toThrow(/HTTP 401/);
  });
});
