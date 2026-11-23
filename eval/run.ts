// Deterministic eval: ten questions a coding agent asks at the start of a ticket, each with a gold
// answer. For every task we record (1) whether the tool's answer matches the gold answer and
// (2) how much text the agent receives from the tool vs the files it would otherwise have to read.
// Usage: npm run eval [-- <repo>]   (defaults to the fictional fixture)
import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { brief, next, openDecisions, ticket } from '../src/tools.js'

const repo = process.argv[2] ?? fileURLToPath(new URL('../fixtures/demo-repo', import.meta.url))
const isFixture = !process.argv[2]

const size = (rel: string) => {
  try {
    return readFileSync(join(repo, rel)).byteLength
  } catch {
    return 0
  }
}
const ticketFiles = readdirSync(join(repo, 'tickets'))
  .filter((f) => /^fase-\d+\.md$/.test(f))
  .map((f) => `tickets/${f}`)
const rawBytes = (files: string[]) => files.reduce((s, f) => s + size(f), 0)
const out = (v: unknown) => Buffer.byteLength(typeof v === 'string' ? v : JSON.stringify(v, null, 2))

interface Task {
  question: string
  tool: string
  run: () => unknown
  check: (r: any) => boolean
  // Files an agent without the server would read to answer the same question.
  without: string[]
}

const fixtureTasks: Task[] = [
  {
    question: 'What is the project invariant I must not break?',
    tool: 'brief',
    run: () => brief(repo),
    check: (r: string) => r.includes('never confirms an appointment it cannot keep'),
    without: ['CLAUDE.md'],
  },
  {
    question: 'How many tickets are done, open and in flight?',
    tool: 'brief',
    run: () => brief(repo),
    check: (r: string) => r.includes('✅ 2') && r.includes('⬜ 7') && r.includes('🟦 1'),
    without: ticketFiles,
  },
  {
    question: 'Which tickets can I start right now (batch of 3)?',
    tool: 'next_tickets',
    run: () => next(repo, 3),
    check: (r) => JSON.stringify(r.batch.map((t: any) => t.id)) === '["F1-003","F1-007"]',
    without: [...ticketFiles, 'DECISIONS.md'],
  },
  {
    question: 'Is F1-005 startable? (its module overlaps a ticket in flight)',
    tool: 'next_tickets',
    run: () => next(repo, 10),
    check: (r) => !r.batch.some((t: any) => t.id === 'F1-005'),
    without: [...ticketFiles, 'DECISIONS.md'],
  },
  {
    question: 'What is the Definition of Done of F1-004?',
    tool: 'get_ticket',
    run: () => ticket(repo, 'F1-004'),
    check: (r) => r.ticket.includes('`createBooking` maps the constraint error to `slot_taken`'),
    without: ticketFiles,
  },
  {
    question: 'Why can F1-008 not start?',
    tool: 'get_ticket',
    run: () => ticket(repo, 'F1-008'),
    check: (r) => r.ready === false && r.problems.includes('blocked by open decision A-01'),
    without: [...ticketFiles, 'DECISIONS.md'],
  },
  {
    question: 'Is F1-010 ready by the Definition of Ready?',
    tool: 'get_ticket',
    run: () => ticket(repo, 'F1-010'),
    check: (r) => r.ready === false && r.problems.includes('missing field: Riesgo'),
    without: ticketFiles,
  },
  {
    question: 'Which decisions are still open?',
    tool: 'open_decisions',
    run: () => openDecisions(repo),
    check: (r) => JSON.stringify(r.map((d: any) => d.id)) === '["A-01","A-02"]',
    without: ['DECISIONS.md'],
  },
  {
    question: 'Which open decisions are critical and irreversible?',
    tool: 'open_decisions',
    run: () => openDecisions(repo, 'critico'),
    check: (r) => r.length === 1 && r[0].id === 'A-02' && r[0].reversible === 'no',
    without: ['DECISIONS.md'],
  },
  {
    question: 'Does ticket F1-999 exist?',
    tool: 'get_ticket',
    run: () => ticket(repo, 'F1-999'),
    check: (r) => r.found === false,
    without: ticketFiles,
  },
]

// On a real repo there is no gold set, so only the size comparison is reported.
const realTasks: Task[] = fixtureTasks
  .filter((t) => ['brief', 'next_tickets', 'open_decisions'].includes(t.tool))
  .slice(0, 5)
  .map((t) => ({ ...t, check: () => true }))

const tasks = isFixture ? fixtureTasks : realTasks
const rows = tasks.map((t) => {
  const r = t.run()
  const ok = t.check(r)
  const toolBytes = out(r)
  const fileBytes = rawBytes([...new Set(t.without)])
  return { ...t, ok, toolBytes, fileBytes }
})

const passed = rows.filter((r) => r.ok).length
const totalTool = rows.reduce((s, r) => s + r.toolBytes, 0)
const totalFiles = rows.reduce((s, r) => s + r.fileBytes, 0)
const pct = (a: number, b: number) => (b === 0 ? '—' : `${Math.round((1 - a / b) * 100)}%`)

const lines = [
  `# racha-mcp eval — ${isFixture ? 'fictional fixture' : 'real repo (sizes only)'}`,
  '',
  isFixture ? `**Correct answers: ${passed}/${rows.length}**` : '_No gold answers on a real repo; sizes only._',
  `**Text the agent receives: ${totalTool.toLocaleString('en')} bytes with the server vs ${totalFiles.toLocaleString('en')} reading the files (${pct(totalTool, totalFiles)} less)**`,
  '',
  '| # | Question | Tool | Correct | Tool bytes | File bytes | Saved |',
  '|---|---|---|---|---|---|---|',
  ...rows.map(
    (r, i) =>
      `| ${i + 1} | ${r.question} | \`${r.tool}\` | ${isFixture ? (r.ok ? '✅' : '❌') : '—'} | ${r.toolBytes} | ${r.fileBytes} | ${pct(r.toolBytes, r.fileBytes)} |`,
  ),
  '',
  'Bytes, not tokens: a rough proxy (≈4 bytes per token for English, fewer for Spanish and emoji).',
  '"File bytes" counts the whole files an agent would open to answer without the server; it does not',
  'count the reasoning needed to apply the eligibility rules by hand, which is where agents actually err.',
]
console.log(lines.join('\n'))
if (isFixture) writeFileSync(fileURLToPath(new URL('./RESULTS.md', import.meta.url)), lines.join('\n') + '\n')
process.exit(isFixture && passed !== rows.length ? 1 : 0)
