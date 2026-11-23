# Agenda Demo (fictional project for racha-mcp tests)

## Regla #1 — The system never confirms an appointment it cannot keep

> The system **never confirms an appointment it cannot keep.** A slot is offered only if it is inside
> opening hours, free of other appointments and not blocked; the database makes a double booking
> impossible.
>
> If you are about to check "is it free?" with a read before a write instead of trusting the
> exclusion constraint — **stop.**

## Stack

- web: Next.js + Prisma + Postgres
- dominio: pure rules, no framework
