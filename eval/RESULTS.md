# racha-mcp eval — fictional fixture

**Correct answers: 10/10**
**Text the agent receives: 4,777 bytes with the server vs 24,491 reading the files (80% less)**

| # | Question | Tool | Correct | Tool bytes | File bytes | Saved |
|---|---|---|---|---|---|---|
| 1 | What is the project invariant I must not break? | `brief` | ✅ | 875 | 555 | -58% |
| 2 | How many tickets are done, open and in flight? | `brief` | ✅ | 875 | 2973 | 71% |
| 3 | Which tickets can I start right now (batch of 3)? | `next_tickets` | ✅ | 490 | 3598 | 86% |
| 4 | Is F1-005 startable? (its module overlaps a ticket in flight) | `next_tickets` | ✅ | 490 | 3598 | 86% |
| 5 | What is the Definition of Done of F1-004? | `get_ticket` | ✅ | 430 | 2973 | 86% |
| 6 | Why can F1-008 not start? | `get_ticket` | ✅ | 378 | 3598 | 89% |
| 7 | Is F1-010 ready by the Definition of Ready? | `get_ticket` | ✅ | 355 | 2973 | 88% |
| 8 | Which decisions are still open? | `open_decisions` | ✅ | 571 | 625 | 9% |
| 9 | Which open decisions are critical and irreversible? | `open_decisions` | ✅ | 293 | 625 | 53% |
| 10 | Does ticket F1-999 exist? | `get_ticket` | ✅ | 20 | 2973 | 99% |

Bytes, not tokens: a rough proxy (≈4 bytes per token for English, fewer for Spanish and emoji).
"File bytes" counts the whole files an agent would open to answer without the server; it does not
count the reasoning needed to apply the eligibility rules by hand, which is where agents actually err.
