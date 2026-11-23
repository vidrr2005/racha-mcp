#!/usr/bin/env node
// racha-mcp — a read-only MCP server that gives a coding agent the state of a spec-first,
// ticket-driven repo in one call instead of making it read whole files.
// Repo root: $RACHA_REPO, else the current working directory.
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'
import { brief, next, openDecisions, ticket } from './tools.js'

const root = process.env.RACHA_REPO ?? process.cwd()
const readOnly = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }
const text = (value: unknown) => ({
  content: [{ type: 'text' as const, text: typeof value === 'string' ? value : JSON.stringify(value, null, 2) }],
})

const server = new McpServer({ name: 'racha-mcp', version: '0.1.0' })

server.registerTool(
  'brief',
  {
    title: 'Project brief',
    description:
      'State of the project in at most 60 lines: the core invariant (Rule #1), the head of STATUS.md, ticket counts by status and open decisions. Call this first in a session.',
    annotations: readOnly,
  },
  async () => text(brief(root)),
)

server.registerTool(
  'next_tickets',
  {
    title: 'Tickets ready to start',
    description:
      'Tickets that can start now: status ⬜, every dependency ✅, not blocked by an open decision, module not already in flight. Returns a batch spread across surfaces.',
    inputSchema: { n: z.number().int().min(1).max(10).default(3).describe('Batch size') },
    annotations: readOnly,
  },
  async ({ n }) => text(next(root, n)),
)

server.registerTool(
  'get_ticket',
  {
    title: 'Ticket and readiness check',
    description:
      "One ticket's full block (fields and Definition of Done) plus its Definition-of-Ready check: missing fields, unfinished dependencies, blocking open decisions.",
    inputSchema: { id: z.string().regex(/^[Ff]\d+-\d{3}$/).describe('Ticket id, e.g. F1-012') },
    annotations: readOnly,
  },
  async ({ id }) => text(ticket(root, id)),
)

server.registerTool(
  'open_decisions',
  {
    title: 'Open decisions',
    description:
      'Decisions still open (🔴) with who decides (class), whether they are reversible, which tickets they block, when they are due, the recommendation and the fallback plan.',
    inputSchema: {
      class: z.enum(['producto', 'critico', 'operativo']).optional().describe('Filter by decision class'),
    },
    annotations: readOnly,
  },
  async (args) => text(openDecisions(root, args.class)),
)

await server.connect(new StdioServerTransport())
