import { describe, expect, it } from 'vitest'
import { fileURLToPath } from 'node:url'
import { brief, loadTickets, next, openDecisions, ticket } from '../src/tools.js'
import { batch, parseTickets, type Ticket } from '../src/backlog.js'

const repo = fileURLToPath(new URL('../fixtures/demo-repo', import.meta.url))

describe('parser', () => {
  it('reads every ticket block with its fields and DoD', () => {
    const tickets = loadTickets(repo)
    expect(tickets.map((t) => t.id)).toEqual([
      'F1-001', 'F1-002', 'F1-003', 'F1-004', 'F1-005', 'F1-006', 'F1-007', 'F1-008', 'F1-009', 'F1-010', 'F1-011',
    ])
    const t2 = tickets.find((t) => t.id === 'F1-002')!
    expect(t2.status).toBe('✅')
    expect(t2.module).toBe('apps/web/prisma')
    expect(t2.dependencies).toEqual(['F1-001'])
    expect(t2.dod).toHaveLength(1)
  })

  it('a section header ends the block, so the next ticket does not inherit it', () => {
    const t3 = loadTickets(repo).find((t) => t.id === 'F1-003')!
    expect(t3.raw).not.toContain('Ola 2')
    expect(t3.raw.split('\n')[0]).toBe('F1-003 — Reminders are scheduled one day before the appointment')
  })

  it('"—" means no dependencies', () => {
    const [t] = parseTickets('x', 'F9-001 — t\n  Dependencias: —\n  Bloqueado por: —\n')
    expect(t!.dependencies).toEqual([])
    expect(t!.blockedBy).toEqual([])
  })
})

describe('next_tickets', () => {
  it('returns only what can start, never the same module twice', () => {
    const r = next(repo, 3)
    // F1-005 shares lib/db with F1-004 (in flight); F1-006 waits for F1-004; F1-008/009 are blocked by
    // open decisions; F1-010 is eligible but shares packages/dominio with F1-003 in the same batch.
    expect(r.batch.map((t) => t.id)).toEqual(['F1-003', 'F1-007'])
    expect(r.eligibleCount).toBe(3)
  })

  it('batch size is respected', () => {
    expect(next(repo, 1).batch).toHaveLength(1)
  })

  it('round-robins across surfaces', () => {
    const mk = (id: string, surface: string, module: string) =>
      ({ id, surface, module }) as unknown as Ticket
    const out = batch([mk('a', 'web', 'w1'), mk('b', 'web', 'w2'), mk('c', 'dominio', 'd1')], 2)
    expect(out.map((t) => t.id)).toEqual(['c', 'a']) // canonical order: dominio before web
  })
})

describe('get_ticket', () => {
  it('a ready ticket has no problems', () => {
    expect(ticket(repo, 'F1-003')).toMatchObject({ found: true, ready: true, problems: [] })
  })

  it('names the open decision that blocks a ticket', () => {
    expect(ticket(repo, 'f1-008').problems).toContain('blocked by open decision A-01')
  })

  it('flags a missing field and an unfinished dependency', () => {
    expect(ticket(repo, 'F1-010').problems).toContain('missing field: Riesgo')
    expect(ticket(repo, 'F1-006').problems).toContain('dependency F1-004 is not done (🟦)')
  })

  it('an unknown id is not found, not an error', () => {
    expect(ticket(repo, 'F1-999')).toEqual({ found: false })
  })
})

describe('open_decisions and brief', () => {
  it('lists only open decisions and filters by class', () => {
    expect(openDecisions(repo).map((d) => d.id)).toEqual(['A-01', 'A-02'])
    expect(openDecisions(repo, 'critico').map((d) => d.id)).toEqual(['A-02'])
    expect(openDecisions(repo)[0]).toMatchObject({ blocks: ['F1-008'], reversible: 'sí' })
  })

  it('brief fits in 60 lines and carries rule #1, counts and open decisions', () => {
    const b = brief(repo)
    expect(b.split('\n').length).toBeLessThanOrEqual(60)
    expect(b).toContain('## Regla #1')
    expect(b).toContain('## Tickets: 11 — ✅ 2 · ⬜ 7 · 🟦 1 · ✂ 1')
    expect(b).toContain('- A-02 Whether patients can cancel by link (critico; blocks F1-009)')
    expect(b).not.toContain('A-03')
  })
})
