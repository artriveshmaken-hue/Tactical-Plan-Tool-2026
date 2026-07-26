# The global filter bar is the single source of truth for activity scoping

A pilot review surfaced filters that "don't work". An audit found four distinct causes, all stemming from having no single owner of scoping. The 2026 baseline was never filtered at all (`app.js` filtered only the 2027 side into `acts`, and every view then read `baseline.activities` raw), so any active filter silently produced nonsense YoY figures — filter to Activity Type `FAM` and the 2027 column showed FAM while the 2026 column showed all 629 activities. The Violations and Rules views ignored the global bar entirely. The Calendar carried its own Region / Market / Activity Type filters *and* received already-filtered data, so the two layers compounded invisibly. And the export always wrote every violation regardless of what was on screen.

We made the global bar the only place activities are scoped: it is multi-select (each filter with its own Clear, plus a global Reset), and one shared predicate applies it to the 2027 activities, the 2026 baseline, the violation list, and the rule counts alike. Views keep only filters that express something the global bar cannot.

**Status**: accepted

## What each view owns now

| View | Local filters retained |
|---|---|
| Overview | none |
| Portfolio | With / Without JMPs toggle |
| Market Review | market selector; Activity Type scoped to the type-breakdown table |
| Calendar | none — it shows the global scope as a text label |
| Violations | Severity, Rule, Category, Status *(violation properties, not activity properties)* |
| Rules | none |

## Considered Options

- **Per-page independent filters, no global bar** — rejected: filter choices would not carry across tabs, so a market-by-market review means re-picking the same filters on every page.
- **Fix the bugs but keep the Calendar's duplicate filters** — rejected: the "filter in two places" confusion was itself one of the reported problems.

## Consequences

- The Calendar's Activity Type multi-select, added shortly before this decision, was removed — the global bar now covers it and the Calendar displays the active scope as text instead.
- Priority cannot apply to market-level violations (rules 1.2, 5.1, 6.1 and B.1 have no single activity, so no priority). The shared predicate therefore skips the priority test for any violation without one, rather than excluding them.
- Both years are filtered with the same predicate, so a market or type present in only one year drops out of both sides together. That is what keeps a comparison honest, but it does mean a filtered view can hide a genuine removal.
