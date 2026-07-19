# Match JMPs across years by JMP-ID, not Activity Name

Every cross-year comparison (`compareYears()`, rule 1.1, rule 8.4) matched activities using `market + activityName` as an exact string key. This works for most activity types, but JMP names always include a year suffix that changes every Cycle (e.g. "TUI DACH JMP 2026-2027" → "TUI DACH JMP 2027-2028" the following year), so a continuing JMP partnership was always wrongly treated as a brand-new activity — inflating the "New" count and, for other rules that aren't already JMP-exempt, risking false violations.

Inspection of real sample files (2026 and 2027 Tactical Details) found a `JMP-ID` column, unused by the parser, that reliably identifies the same contract term across the Cycle it's signed (as New JMP) and the following Cycle where it continues (as Existing JMP) — populated on ~95%+ of the rows where that link actually matters. We decided to match JMP-type activities across years by `JMP-ID` first, falling back to (year-suffix-stripped base name + Activity Start/End date continuity) only for the remaining JMPs with no `JMP-ID` on one or both sides.

**Status**: accepted

## Considered Options

- **Keep exact-name matching** — rejected: this is the bug being fixed.
- **Strip year suffixes from names and match on the result alone** — rejected: a market can have two live JMP terms for the same partner in the same file (e.g. "...2026-2027" and "...2027-2028" both present in the 2027 Review), so a stripped name alone is ambiguous; date continuity is needed to pick the right one.
- **Require JMP-ID on every JMP row and flag missing ones as a violation** — rejected: ~96% of freshly-signed New JMP rows don't have a JMP-ID yet by the time they're first submitted (assigned later in the JMP's lifecycle), so this would manufacture ~130 false violations rather than reflect a real process gap.

## Consequences

- The small remainder of JMPs missing a `JMP-ID` on either side still rely on the name+date fallback, which is a heuristic, not a guarantee — it can still mismatch in unusual cases (e.g. two JMPs for the same market whose date ranges both plausibly connect).
