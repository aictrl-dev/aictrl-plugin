#!/usr/bin/env node

import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const PRODUCTION_MCP_URL = 'https://aictrl.dev/mcp';

export const EXPECTED_CATALOG = [
  {
    name: 'list_workflows',
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    inputSchema: {
      type: 'object',
      properties: {
        organization_id: { type: 'string', minLength: 1 },
        limit: { type: 'integer', minimum: 1, maximum: 100 },
      },
      required: ['organization_id'],
      additionalProperties: false,
    },
  },
  {
    name: 'get_workflow',
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    inputSchema: {
      type: 'object',
      properties: {
        organization_id: { type: 'string', minLength: 1 },
        workflow_id: { type: 'string', minLength: 1 },
      },
      required: ['organization_id', 'workflow_id'],
      additionalProperties: false,
    },
  },
  {
    name: 'start_workflow',
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: true },
    inputSchema: {
      type: 'object',
      properties: {
        organization_id: { type: 'string', minLength: 1 },
        workflow_id: { type: 'string', minLength: 1 },
        idempotency_key: { type: 'string', minLength: 8, maxLength: 200 },
        inputs: { type: 'object', additionalProperties: true },
      },
      required: ['organization_id', 'workflow_id', 'idempotency_key'],
      additionalProperties: false,
    },
  },
  {
    name: 'get_workflow_run',
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    inputSchema: {
      type: 'object',
      properties: {
        organization_id: { type: 'string', minLength: 1 },
        run_id: { type: 'string', minLength: 1 },
      },
      required: ['organization_id', 'run_id'],
      additionalProperties: false,
    },
  },
  {
    name: 'approve_workflow_step',
    annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: true },
    inputSchema: {
      type: 'object',
      properties: {
        organization_id: { type: 'string', minLength: 1 },
        run_id: { type: 'string', minLength: 1 },
        decision: { type: 'string', enum: ['approve', 'reject'] },
        expected_revision: { type: 'string', pattern: '^[0-9a-fA-F]{40}$' },
        note: { type: 'string', maxLength: 2000 },
      },
      required: ['organization_id', 'run_id', 'decision', 'expected_revision'],
      additionalProperties: false,
    },
  },
  {
    name: 'cancel_workflow_run',
    annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: true },
    inputSchema: {
      type: 'object',
      properties: {
        organization_id: { type: 'string', minLength: 1 },
        run_id: { type: 'string', minLength: 1 },
        reason: { type: 'string', maxLength: 2000 },
      },
      required: ['organization_id', 'run_id'],
      additionalProperties: false,
    },
  },
];

export function normalizeCatalog(tools) {
  if (!Array.isArray(tools)) {
    throw new Error('Production MCP tools/list did not return a tools array.');
  }

  return tools.map((tool) => ({
    name: tool?.name,
    annotations: tool?.annotations,
    inputSchema: stripDescriptions(tool?.inputSchema),
  }));
}

export function assertProductionCatalog(tools) {
  assert.deepStrictEqual(
    normalizeCatalog(tools),
    EXPECTED_CATALOG,
    'Production MCP catalog differs from the approved six-tool lifecycle contract.',
  );

  for (const tool of tools) {
    if (typeof tool.description !== 'string' || tool.description.trim() === '') {
      throw new Error(`Production MCP tool ${tool.name ?? '<unnamed>'} has no description.`);
    }
    if (
      typeof tool?._meta?.ui?.resourceUri === 'string'
      || typeof tool?._meta?.['openai/outputTemplate'] === 'string'
    ) {
      throw new Error(`Production MCP tool ${tool.name ?? '<unnamed>'} unexpectedly links to custom UI.`);
    }
  }
}

export async function scanProductionCatalog({
  apiKey,
  url = PRODUCTION_MCP_URL,
  fetchImpl = fetch,
} = {}) {
  if (!apiKey) {
    throw new Error('AICTRL_API_KEY is required for the authenticated production MCP scan.');
  }

  const response = await fetchImpl(url, {
    method: 'POST',
    redirect: 'error',
    signal: AbortSignal.timeout(20_000),
    headers: {
      Accept: 'application/json, text/event-stream',
      'Content-Type': 'application/json',
      'MCP-Protocol-Version': '2024-11-05',
      'X-API-Key': apiKey,
    },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} }),
  });

  const body = await response.text();
  if (!response.ok) {
    throw new Error(`Production MCP scan returned HTTP ${response.status}.`);
  }

  const message = parseMcpResponse(body, response.headers.get('content-type'));
  if (message?.error) {
    throw new Error(`Production MCP tools/list returned JSON-RPC error ${message.error.code}.`);
  }
  assertProductionCatalog(message?.result?.tools);
  return message.result.tools;
}

function stripDescriptions(value) {
  if (Array.isArray(value)) return value.map(stripDescriptions);
  if (!value || typeof value !== 'object') return value;

  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => key !== 'description')
      .map(([key, child]) => [key, stripDescriptions(child)]),
  );
}

function parseMcpResponse(body, contentType = '') {
  if (!contentType?.includes('text/event-stream')) {
    return JSON.parse(body);
  }

  const messages = body
    .split(/\r?\n/)
    .filter((line) => line.startsWith('data:'))
    .map((line) => JSON.parse(line.slice(5).trim()));
  const response = messages.find((message) => message?.id === 1);
  if (!response) throw new Error('Production MCP event stream contained no tools/list response.');
  return response;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  try {
    const tools = await scanProductionCatalog({ apiKey: process.env.AICTRL_API_KEY });
    console.log(`Production MCP catalog smoke passed: ${tools.map((tool) => tool.name).join(', ')}.`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
