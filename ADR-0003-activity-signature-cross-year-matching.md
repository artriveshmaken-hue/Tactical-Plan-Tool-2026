# Match activities across years with a tiered Activity Signature

Every cross-year comparison (`compareYears`, rule 1.1, rule 8.4) matched activities on exact `market + activityName`. Activity Names embed the year — `WTM 2026 - Hospitality` becomes `WTM 2027 - Hospitality`, `TUI DACH JMP 2026-2027` becomes `TUI DACH JMP 2027-2028` — so recurring activities were reported as brand new every Cycle. The symptom in the pilot: 17 of 20 rule-8.4 "new activity over AED 500K" flags were ordinary annual exhibitions, and the Overview claimed 239 of 591 activities were new.

We replaced it (and the narrower JMP-only fix from ADR-0002) with a single **Activity Signature** matcher: five passes, run globally in tier order, stopping at the first confident match. Passes 3–5 also require that any year tokens in the two names be identical or consecutive.

**Status**: accepted — supersedes ADR-0002

## The tiers

| # | Pass | Fence | Requires unique candidate |
|---|---|---|---|
| 1 | Exact name | Market + Type Family | no |
| 2 | JMP-ID | **none** — the ID is definitive | no |
| 2b | Exact name, retyped | Market only | yes |
| 3 | Year-stripped name | Market + Type Family | yes |
| 4 | Unique anchor token | Market + Type Family | yes |

Tiers run as global passes rather than per-activity, so a stronger match always wins over a weaker one regardless of row order.

## Considered Options

- **Market + Activity Type + Month** (the first suggestion) — rejected: five different exhibitions share Market `Exhibitions` + Type `Space Rent` (WTM, ITB Berlin, ATM, ILTM, KITF), so month is not a discriminator, and event months shift between years.
- **Year-stripped name alone, no anchor pass** — rejected: leaves reworded lines unmatched, e.g. `WTM 2026 - Stand Build` → `WTM 2026 Stand Build Up Payment`.
- **Strict Activity Type fence on every tier** — rejected: 136 of 145 JMPs present in both files change type between years, because `New JMP → Existing JMP` is the normal contract lifecycle. A strict fence would have failed to match almost every JMP. Hence the JMP type family and the unfenced JMP-ID pass.
- **No year-adjacency guard** — rejected after testing: without it, tier 3 paired `TUI DACH JMP 2025-2026` (a term that genuinely ended) with `TUI DACH JMP 2027-2028` (a genuinely new signing), skipping the 2026-2027 term entirely. Serially-named activities need the years to actually connect.

## Consequences

- Tiers 2b–4 are heuristics, not guarantees. Each declines rather than guesses when more than one candidate fits, but a wrong pairing is still possible in principle. The Market Review comparison table therefore shows a **"Matched by"** column naming the tier that paired each row, so a reviewer can audit and spot a bad match instead of trusting it blindly.
- Rule 1.1 violations rose from 13 to 34. This is the fix working, not a regression: activities that previously looked new now find their 2026 baseline, so genuine budget increases are finally detected.
- An activity renamed beyond a year change (e.g. `DCT Roadshow Germany` → `Experience Abu Dhabi Roadshow Germany`) is still reported as removed + new. Deliberate — no automatic rule should guess across a rebrand.
