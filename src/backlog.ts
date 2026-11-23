// Parsers for a spec-first, ticket-driven repo:
//   tickets/fase-N.md   — ticket blocks ("F1-001 — Title" + indented "Key: value" fields + DoD list)
//   DECISIONS.md        — open decisions ("### A-01 — Title" + "Key: value" fields)
// Pure functions: no IO here, so tests and evals can feed fixtures directly.

export interface Ticket {
  id: string
  title: string
  file: string
  line: number
  status: string // first symbol of the Estado field: ⬜ 🟦 ✅ ⏸ ⏭ ✂
  module: string
  surface: string
  risk: string
  spec: string
  dependencies: string[]
  blockedBy: string[]
  dod: string[]
  fields: Record<string, string>
  raw: string
}

export interface Decision {
  id: string
  title: string
  status: string
  open: boolean
  fields: Record<string, string>
  blocks: string[]
}

const TICKET_HEADER = /^(F\d+-\d{3}) — (.+)$/
const DECISION_HEADER = /^### (A-\d+) — (.+)$/

function list(value: string | undefined): string[] {
  if (!value) return []
  const v = value.trim()
  if (v === '—' || v === '-' || v === '') return []
  return v
    .split(',')
    .map((s) => s.trim().split(' ')[0] ?? '')
    .filter((s) => /^[A-Z]\d*-\d+$/.test(s))
}

export function parseTickets(file: string, content: string): Ticket[] {
  const lines = content.split('\n')
  const tickets: Ticket[] = []
  let current: Ticket | null = null
  let start = 0
  let inDod = false
  const close = (end: number) => {
    if (current) current.raw = lines.slice(start, end).join('\n').trimEnd()
  }
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? ''
    const header = line.match(TICKET_HEADER)
    if (header) {
      close(i)
      start = i
      current = {
        id: header[1]!,
        title: header[2]!.trim(),
        file,
        line: i + 1,
        status: '',
        module: '',
        surface: '',
        risk: '',
        spec: '',
        dependencies: [],
        blockedBy: [],
        dod: [],
        fields: {},
        raw: '',
      }
      tickets.push(current)
      inDod = false
      continue
    }
    if (!current) continue
    if (line.startsWith('#')) {
      close(i)
      current = null
      inDod = false
      continue
    }
    const field = line.match(/^ {2}([A-Za-zÁ-úñ][A-Za-zÁ-úñ -]*):\s?(.*)$/)
    if (field) {
      const key = field[1]!.trim()
      const value = field[2]!.trim()
      current.fields[key] = value
      inDod = key === 'DoD'
      if (key === 'Estado') current.status = value.split(' ')[0] ?? ''
      else if (key === 'Módulo') current.module = value
      else if (key === 'Superficie') current.surface = value
      else if (key === 'Riesgo') current.risk = value
      else if (key === 'Spec') current.spec = value
      else if (key === 'Dependencias') current.dependencies = list(value)
      else if (key === 'Bloqueado por') current.blockedBy = list(value)
      continue
    }
    if (inDod && /^ {4}- /.test(line)) current.dod.push(line.slice(6).trim())
  }
  close(lines.length)
  return tickets
}

export function parseDecisions(content: string): Decision[] {
  const decisions: Decision[] = []
  let current: Decision | null = null
  for (const line of content.split('\n')) {
    const header = line.match(DECISION_HEADER)
    if (header) {
      current = { id: header[1]!, title: header[2]!.trim(), status: '', open: false, fields: {}, blocks: [] }
      decisions.push(current)
      continue
    }
    if (!current) continue
    if (line.startsWith('## ')) {
      current = null
      continue
    }
    const field = line.match(/^([A-Za-zÁ-úñ][A-Za-zÁ-úñ -]*):\s?(.*)$/)
    if (!field) continue
    const key = field[1]!.trim()
    const value = field[2]!.trim()
    current.fields[key] = value
    if (key === 'Estado') {
      current.status = value
      current.open = value.includes('🔴')
    }
    if (key === 'Bloquea') current.blocks = list(value)
  }
  return decisions
}

function sameModule(a: string, b: string): boolean {
  return a !== '' && b !== '' && (a === b || a.startsWith(b + '/') || b.startsWith(a + '/'))
}

/** Ready to start: ⬜, every dependency ✅, not blocked by an open decision, module not in flight. */
export function eligible(tickets: Ticket[], openDecisions: Set<string>): Ticket[] {
  const byId = new Map(tickets.map((t) => [t.id, t]))
  const busy = tickets.filter((t) => t.status === '🟦').map((t) => t.module)
  return tickets.filter(
    (t) =>
      t.status === '⬜' &&
      t.dependencies.every((d) => byId.get(d)?.status === '✅') &&
      !t.blockedBy.some((a) => openDecisions.has(a)) &&
      !busy.some((m) => sameModule(m, t.module)),
  )
}

/** Round-robin across surfaces, never two tickets of the same module in one batch. */
export const SURFACE_ORDER = ['dominio', 'integraciones', 'web', 'movil', 'infra']

export function batch(candidates: Ticket[], n: number): Ticket[] {
  const present = new Set(candidates.map((t) => t.surface))
  const surfaces = [
    ...SURFACE_ORDER.filter((s) => present.has(s)),
    ...[...present].filter((s) => !SURFACE_ORDER.includes(s)),
  ]
  const queues = new Map(surfaces.map((s) => [s, candidates.filter((t) => t.surface === s)]))
  const out: Ticket[] = []
  let progress = true
  while (out.length < n && progress) {
    progress = false
    for (const s of surfaces) {
      const queue = queues.get(s)!
      while (queue.length > 0 && out.length < n) {
        const t = queue.shift()!
        if (out.some((x) => sameModule(x.module, t.module))) continue
        out.push(t)
        progress = true
        break
      }
    }
  }
  return out
}

const REQUIRED_FIELDS = ['Estado', 'Módulo', 'Superficie', 'Riesgo', 'Spec', 'DoD']

/** Definition of Ready: what stops this ticket from being started right now. Empty = ready. */
export function readinessProblems(ticket: Ticket, tickets: Ticket[], openDecisions: Set<string>): string[] {
  const problems: string[] = []
  for (const f of REQUIRED_FIELDS) if (!(f in ticket.fields)) problems.push(`missing field: ${f}`)
  if (ticket.dod.length === 0) problems.push('DoD has no items')
  const byId = new Map(tickets.map((t) => [t.id, t]))
  for (const d of ticket.dependencies) {
    const dep = byId.get(d)
    if (!dep) problems.push(`dependency ${d} does not exist`)
    else if (dep.status !== '✅') problems.push(`dependency ${d} is not done (${dep.status})`)
  }
  for (const a of ticket.blockedBy) if (openDecisions.has(a)) problems.push(`blocked by open decision ${a}`)
  if (ticket.status !== '⬜') problems.push(`status is ${ticket.status}, not ⬜`)
  return problems
}
