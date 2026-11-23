# racha-mcp

A small, read-only [MCP](https://modelcontextprotocol.io) server that gives a coding agent the state
of a spec-first, ticket-driven repository in one call, instead of making it read whole backlog files
and apply the scheduling rules by hand.

It was written for the methodology I use with Claude Code: tickets with a Definition of Ready and a
Definition of Done, open decisions that block work until a person resolves them, and up to three agents
working in parallel in separate worktrees. The tools below encode the rules an agent needs before it
starts a ticket.

## Tools

| Tool | What it answers |
|---|---|
| `brief` | The project's core invariant ("Rule #1" in `CLAUDE.md`), the head of `STATUS.md`, ticket counts by status and open decisions, in at most 60 lines. |
| `next_tickets` | Which tickets can start now: status ⬜, every dependency ✅, not blocked by an open decision, module not already in flight. Returns a batch spread across surfaces, never two tickets of the same module. |
| `get_ticket` | One ticket's block (fields and Definition of Done) plus its Definition-of-Ready check: missing fields, unfinished dependencies, blocking decisions. |
| `open_decisions` | Open decisions with their class (who decides), reversibility, the tickets they block, due date, recommendation and fallback plan. |

All four are annotated `readOnlyHint: true`. The server never writes, merges or calls the network.

## Repository format

```
CLAUDE.md            ## Regla #1 — … section (the invariant)
STATUS.md            free text; the head is shown
DECISIONS.md         ### A-01 — Title, then Estado: 🔴 abierto · Clase · Reversible · Bloquea · Vence · Recomendación · Plan alterno
tickets/fase-N.md    F1-001 — Title, then indented Estado · Módulo · Superficie · Riesgo · Dependencias · Bloqueado por · Spec · DoD
```

See [`fixtures/demo-repo`](fixtures/demo-repo) for a complete, fictional example.

## Use it with Claude Code

```bash
npm install && npm run build
```

Then add it to the target repo's `.mcp.json` (see [`examples/.mcp.json`](examples/.mcp.json)):

```json
{
  "mcpServers": {
    "racha": {
      "command": "node",
      "args": ["/path/to/racha-mcp/dist/server.js"],
      "env": { "RACHA_REPO": "." }
    }
  }
}
```

`RACHA_REPO` is the repository root; without it the server uses its working directory.

## Tests and eval

```bash
npm test        # parser, rules and an end-to-end test that starts the server and talks MCP over stdio
npm run eval    # ten questions with gold answers on the fixture
```

- **Correctness:** 10/10 on the fixture ([`eval/RESULTS.md`](eval/RESULTS.md)). Each scheduling rule has a
  test that fails when the rule is removed (five hand-made mutations, all caught).
- **Context size:** on the fixture the agent receives 80% less text than reading the files it would
  otherwise open; on a real backlog of ~120 tickets, 98% less.
- **Agreement:** on seven private repositories that use this methodology, `next_tickets` returns the same
  batch as each repo's own scheduling script.

The eval is deterministic and does not call a model. The next step is an agent-in-the-loop eval: the
same questions answered by an agent with and without the server, scored on accuracy and tokens used.

## License

MIT
