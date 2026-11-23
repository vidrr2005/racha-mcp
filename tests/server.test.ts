// End-to-end: start the real server over stdio and talk MCP to it.
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { fileURLToPath } from 'node:url'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'

const repo = fileURLToPath(new URL('../fixtures/demo-repo', import.meta.url))
const server = fileURLToPath(new URL('../src/server.ts', import.meta.url))
const client = new Client({ name: 'test', version: '0.0.0' })

beforeAll(async () => {
  await client.connect(
    new StdioClientTransport({
      command: process.execPath,
      args: ['--import', 'tsx', server],
      env: { ...process.env, RACHA_REPO: repo } as Record<string, string>,
    }),
  )
}, 20_000)
afterAll(() => client.close())

const call = async (name: string, args: Record<string, unknown> = {}) => {
  const r = await client.callTool({ name, arguments: args })
  return (r.content as { text: string }[])[0]!.text
}

describe('MCP server', () => {
  it('exposes exactly four read-only tools', async () => {
    const { tools } = await client.listTools()
    expect(tools.map((t) => t.name).sort()).toEqual(['brief', 'get_ticket', 'next_tickets', 'open_decisions'])
    for (const t of tools) expect(t.annotations?.readOnlyHint).toBe(true)
  })

  it('answers next_tickets over the wire', async () => {
    expect(JSON.parse(await call('next_tickets', { n: 3 })).batch.map((t: { id: string }) => t.id)).toEqual([
      'F1-003',
      'F1-007',
    ])
  })

  it('rejects a malformed ticket id', async () => {
    const r = await client.callTool({ name: 'get_ticket', arguments: { id: 'drop table' } })
    expect(r.isError).toBe(true)
  })
})
