# Persist violation review state in localStorage, keyed by Violation Identity

The tool has no server and no login (by design — see `CONTEXT.md` constraints), so the only place to persist anything is the browser itself. Without persistence, marking a Violation Accepted or Action Required only lived in memory — refreshing the page or reopening the tool later reset every decision back to Pending, which undermines the Violations tab's purpose as an action centre for a review that spans more than one sitting.

We decided to persist Status + Justification to `localStorage`, keyed by Violation Identity (Rule ID + Market + Tactical ID + Activity Name for activity-level rules; Rule ID + Market + label for market-level rules, which have no real per-activity ID). On a later session, a Violation that still fires reattaches its saved Status/Justification automatically; if the rule stops firing, the Violation simply disappears with no separate "resolved" tracking.

**Status**: accepted

## Considered Options

- **No persistence, export is the only record** — rejected: doesn't support a review that spans multiple sittings across 3-4 people.
- **Append-only audit log (who/when/why)** — rejected: no login exists to attribute "who," and the team explicitly doesn't need history, only the current justification.
- **Cross-person sync via re-importing a prior export** — deferred: adds real complexity (file-diffing, merge conflicts) that wasn't asked for; can be revisited if single-browser persistence proves insufficient in practice.

## Consequences

- Market-level and B.1-outlier Violations have no real per-activity Tactical ID, so their identity key (Rule + Market + label) is not Cycle-scoped — a Justification from one Cycle could resurface in an unrelated future Cycle for the same market/rule. Accepted as a known limitation rather than building Cycle-detection.
- Decisions are local to one browser/machine. If the Director and PMO use different machines, their accepted/justified decisions do not sync between them.
