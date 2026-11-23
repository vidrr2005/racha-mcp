// The four read-only tools, as plain functions over a repo root. The MCP server and the eval call
// these; nothing here writes, merges or calls the network.
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  batch,
  eligible,
  parseDecisions,
  parseTickets,
  readinessProblems,
  type Decision,
  type Ticket,
} from './backlog.js'

const read = (root: string, rel: string) =>
  existsSync(join(root, rel)) ? readFileSync(join(root, rel), 'utf8') : ''

export function loadTickets(root: string): Ticket[] {
  const dir = join(root, 'tickets')
  if (!existsSync(dir)) return []
  return readdirSync(dir)
    .filter((f) => /^fase-\d+\.md$/.test(f))
    .sort()
    .flatMap((f) => parseTickets(`tickets/${f}`, read(root, `tickets/${f}`)))
}

export function loadDecisions(root: string): Decision[] {
  return parseDecisions(read(root, 'DECISIONS.md'))
}

const openSet = (decisions: Decision[]) => new Set(decisions.filter((d) => d.open).map((d) => d.id))

/** The project's core invariant: the "## Regla #1" section of CLAUDE.md, if any. */
export function ruleOne(root: string): string {
  const lines = read(root, 'CLAUDE.md').split('\n')
  const start = lines.findIndex((l) => /^## Regla #1/.test(l))
  if (start < 0) return ''
  const end = lines.findIndex((l, i) => i > start && /^## /.test(l))
  return lines
    .slice(start, end < 0 ? undefined : end)
    .join('\n')
    .trim()
}

/** State of the project in ≤60 lines: rule #1, the head of STATUS.md, ticket counts, open decisions. */
export function brief(root: string): string {
  const tickets = loadTickets(root)
  const decisions = loadDecisions(root)
  const counts = new Map<string, number>()
  for (const t of tickets) counts.set(t.status, (counts.get(t.status) ?? 0) + 1)
  const open = decisions.filter((d) => d.open)
  const out: string[] = []
  const rule = ruleOne(root)
  if (rule) out.push(...rule.split('\n').slice(0, 12), '')
  const status = read(root, 'STATUS.md').split('\n').filter((l) => l.trim() !== '').slice(0, 15)
  if (status.length) out.push('## STATUS (head)', ...status.map((l) => l.slice(0, 300)), '')
  out.push(
    `## Tickets: ${tickets.length} — ` +
      [...counts.entries()].map(([s, n]) => `${s} ${n}`).join(' · '),
  )
  out.push(`## Open decisions: ${open.length}`)
  for (const d of open.slice(0, 10)) {
    out.push(`- ${d.id} ${d.title} (${d.fields['Clase'] ?? '?'}; blocks ${d.blocks.join(', ') || '—'})`)
  }
  return out.slice(0, 60).join('\n')
}

export interface NextResult {
  batch: { id: string; title: string; surface: string; module: string; risk: string }[]
  eligibleCount: number
  note: string
}

/** Which tickets can start now (same rules as the repo's own `npm run siguientes`). */
export function next(root: string, n = 3): NextResult {
  const tickets = loadTickets(root)
  const candidates = eligible(tickets, openSet(loadDecisions(root)))
  const chosen = batch(candidates, n)
  return {
    batch: chosen.map((t) => ({ id: t.id, title: t.title, surface: t.surface, module: t.module, risk: t.risk })),
    eligibleCount: candidates.length,
    note:
      chosen.length === 0
        ? 'Nothing is eligible: a legitimate stop. Do not invent scope.'
        : `${candidates.length} eligible; batch of ${chosen.length} spread across surfaces.`,
  }
}

export interface TicketResult {
  found: boolean
  ticket?: string
  ready?: boolean
  problems?: string[]
}

/** One ticket's block plus its Definition-of-Ready check. */
export function ticket(root: string, id: string): TicketResult {
  const tickets = loadTickets(root)
  const t = tickets.find((x) => x.id === id.trim().toUpperCase())
  if (!t) return { found: false }
  const problems = readinessProblems(t, tickets, openSet(loadDecisions(root)))
  return { found: true, ticket: `${t.file}:${t.line}\n${t.raw}`, ready: problems.length === 0, problems }
}

export interface OpenItem {
  id: string
  title: string
  class: string
  reversible: string
  blocks: string[]
  due: string
  recommendation: string
  fallback: string
}

/** Open (🔴) decisions, optionally filtered by class (producto | critico | operativo). */
export function openDecisions(root: string, cls?: string): OpenItem[] {
  return loadDecisions(root)
    .filter((d) => d.open && (!cls || d.fields['Clase'] === cls))
    .map((d) => ({
      id: d.id,
      title: d.title,
      class: d.fields['Clase'] ?? '',
      reversible: d.fields['Reversible'] ?? '',
      blocks: d.blocks,
      due: d.fields['Vence'] ?? '',
      recommendation: d.fields['Recomendación'] ?? '',
      fallback: d.fields['Plan alterno'] ?? '',
    }))
}
