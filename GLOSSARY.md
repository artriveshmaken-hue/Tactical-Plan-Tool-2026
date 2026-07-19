# DCT Tactical Plan Review — Glossary

Domain terms for the Tactical Plan Review Tool. This is a glossary only — implementation details (data model, file structure, rule thresholds) live in `CONTEXT.md`.

## Language

**Baseline**:
The prior year's approved tactical plan (e.g. the 2026 plan), uploaded as the reference point a Review is checked against.
_Avoid_: Previous year, old plan

**Review**:
The tactical plan currently being submitted for approval (e.g. the 2027 plan), uploaded and checked against the Baseline.
_Avoid_: Current plan, new plan, submission

**Cycle**:
One Baseline + Review file pair analysed together in a single upload. A Cycle is what a Violation's saved decision belongs to — decisions from one Cycle are not guaranteed to carry meaning in a different Cycle (see Violation Identity).
_Avoid_: Session, year (a Cycle isn't always exactly one calendar year apart)

**Activity**:
A single planned line item within a Baseline or Review — one row of the Tactical Details sheet, uniquely identified within its file by a Tactical ID.
_Avoid_: Row, line item

**Tactical ID**:
The per-Activity identifier assigned in the source planning system. Stable across re-uploads of the *same* Cycle's file, but not stable across different Cycles — the same real-world activity gets a different Tactical ID next Cycle.
_Avoid_: Activity ID, row ID

**JMP (Joint Marketing Partnership)**:
A multi-year trade partner contract, tracked as one Activity per Cycle (as either a New JMP or an Existing JMP depending on contract stage). Distinguished from other activity types by needing a Hotel Guest Target and being subject to JMP-specific rules.
_Avoid_: Partnership, contract

**JMP-ID**:
A separate, partner-specific identifier (distinct from Tactical ID and Project No.) that stays the same for a given JMP contract term across the Cycle where it's signed (as New JMP) and the following Cycle where it continues (as Existing JMP). The primary way to recognise "the same JMP" year over year — Activity Name alone can't be trusted for this, since names carry a year suffix that changes every Cycle (e.g. "TUI DACH JMP 2026-2027" → "TUI DACH JMP 2027-2028").
_Avoid_: Partner ID, contract ID

**Violation**:
A single instance of an Activity (or a Market, for market-level rules) failing a compliance rule during a Review. Generated fresh by the rules engine on every analysis — a Violation only exists for as long as its triggering condition is still true.
_Avoid_: Flag, issue, finding

**Violation Identity**:
What makes two Violations across different sessions "the same" one, for the purpose of reattaching a saved Status/Justification. For activity-level rules: Rule ID + Market + Tactical ID + Activity Name. For market-level rules (1.2, 5.1, 6.1) and the B.1 outlier rule, which have no real per-activity Tactical ID: Rule ID + Market + label — a weaker identity that can coincidentally match across different Cycles (accepted as a known limitation).
_Avoid_: Violation key, violation ID

**Status**:
A Violation's review state — one of **Pending** (default, unreviewed), **Accepted** (reviewed and justified as-is), or **Action Required** (reviewed, flagged for a fix, justified). Accepted and Action Required both require a Justification; Pending does not.
_Avoid_: State

**Justification**:
The mandatory free-text explanation recorded when a Violation is marked Accepted or Action Required. A single current value, not an attributed or timestamped history — it answers "why," not "who" or "when."
_Avoid_: Comment, note, reason

**Tier**:
A market's priority classification for JMP analysis — Tier 1 (Priority), Tier 2 (Growth), or Tier 3 (Emerging, excluded from JMP analysis).
_Avoid_: Priority level (this is Activity Priority 1/2/3, a different concept)

**Domestic**:
The UAE-internal market, exempt from rules that assume an international JMP contract structure (e.g. rule 1.7 does not apply to Domestic).
_Avoid_: UAE (UAE is itself a separate international market; Domestic is distinct)

**Ramadan Window**:
The fixed date range used by rule 5.1 to identify Ramadan-period activities. Set per Review Cycle (2027: 01/01/2027–15/02/2027) — a business parameter, not derived from activity names.
_Avoid_: Ramadan period (ambiguous — always refer to the specific configured window)
