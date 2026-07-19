# DCT Abu Dhabi — Tactical Plan Review Tool
## Project Context for Claude Code

---

## What This Tool Is

A browser-based compliance and analysis dashboard for the Department of Culture and Tourism, Abu Dhabi (DCT). It is used by the Director and PMO (3-4 people) to review the 2027 tactical plan against the 2026 approved baseline.

- **No server** — runs entirely in the browser
- **No login** — data stays local, never uploaded anywhere
- **Two Excel files** are uploaded by the user: 2026 baseline + 2027 review
- Both files have a sheet called `Tactical Details` which is the only sheet used
- Built with: **SheetJS** (Excel parsing), **Chart.js** (charts), vanilla HTML/CSS/JS

---

## File Structure (all flat — no subfolders)

```
index.html      — upload screen + 6-tab dashboard shell
style.css       — all styling
parser.js       — reads Excel files, normalises data
rules.js        — 21 compliance rules + violation factory
views.js        — all 6 view render functions
app.js          — upload handler, navigation, filter logic
export.js       — Excel + CSV export of violations
dct-logo.png    — DCT Abu Dhabi logo
```

---

## Data Model

Each activity parsed from the Excel file has these fields:

```javascript
{
  market:       string,   // e.g. "Germany", "India", "France"
  id:           string,   // Tactical ID e.g. "3792"
  activityType: string,   // normalised type e.g. "Existing JMP", "FAM"
  activityName: string,   // free text name
  startDate:    Date,
  endDate:      Date,
  locked:       "Locked" | "Not Locked",
  cashflow:     number,   // AED
  priority:     1 | 2 | 3,
  owner:        string,
  attendees:    number,
  stakeholders: number,
  revenue:      number,
  hotelGuests:  number,   // hotel overnight stay target (JMPs only)
  description:  string,
  monthly: {
    Jan, Feb, Mar, Apr, May, Jun,
    Jul, Aug, Sep, Oct, Nov, Dec  // monthly cashflow breakdown
  }
}
```

---

## 6-Tab Structure (story flows high → detail)

### Tab 1: Overview — "What is the state of the plan?"
- 4 health scorecards (Q4 concentration, JMP share, HIGH violations, Tier split)
- Monthly cashflow 2026 vs 2027 bar chart
- Budget by activity type donut chart
- Hotel Guest efficiency table (cost per guest: total budget + JMP budget)
- VS Review benchmarks (GSA %, FAM cost/agent, Exhibition cost/revenue ratio)
- Markets needing attention table (ranked by violations)

### Tab 2: Portfolio — "Is the structure right?"
- Activity type % with/without JMPs toggle
- Tier 1 vs Tier 2 budget split + YoY comparison
- JMP dominance check (flag if JMP is not largest type per market)
- Cost efficiency outliers (>15% above median cost per attendee/stakeholder)

### Tab 3: Market Review — "Market by market detail"
- Market selector dropdown
- Summary panel (2026 → 2027 budget + KPI targets: Attendees, Stakeholders, Hotel Guests)
- Monthly cashflow chart + activity type breakdown table (% with and without JMPs)
- VS Review metrics for that market
- Compliance checklist (8 checks)
- Activity comparison: 2026 vs 2027 (NEW / CHANGED / REMOVED / SAME)

### Tab 4: Calendar — "When is everything happening?"
- Activity type dropdown filter at top
- Market × Month grid (colour by intensity, Q4 cells highlighted red)
- Click any cell → see activities for that market/month
- Monthly cashflow chart at bottom (updates based on filter selection)

### Tab 5: Violations — "What needs action?"
- 5 KPI cards (HIGH / MEDIUM / LOW / Accepted / Action Required)
- 3 charts (by market, by rule, by activity type)
- Full violations table with 8 multi-select filters
- Status toggle per violation: Pending / Accepted / Action Required
- Comment field ("What needs to change")
- Export to Excel or CSV

### Tab 6: Rules — "Reference guide"
- Static reference guide — every rule with plain English explanation
- Why it exists, what triggers it, what to do
- Live violation count per rule

---

## Market & Tier Definitions

### Tier 1 — Priority Markets (11)
China, France, Germany, India, Italy, Kuwait, Russia, Saudi Arabia, UAE, United Kingdom, United States

### Tier 2 — Growth Markets (15)
Armenia, Bahrain, Belgium, Canada, Egypt, Japan, Kazakhstan, Netherlands, Oman, Poland, Qatar, Romania, South Korea, Spain, Uzbekistan

### Tier 3 — Emerging (excluded from JMP analysis)
All others

### Regions
- **Europe & CIS**: France, Germany, Italy, Spain, Poland, Romania, Belgium, Netherlands, Russia, Armenia, Kazakhstan, Uzbekistan
- **APAC**: India, China, Japan, South Korea
- **GCC**: Saudi Arabia, Kuwait, Egypt, UAE, Bahrain, Qatar, Oman, Domestic
- **UK & US**: United Kingdom, United States, Canada
- **PR**: PR & Marketing, B2B PR and Marketing
- **Global**: Global Partnerships, Exhibitions, IO Office

---

## Rule Register (21 rules)

### HIGH Severity — Must fix before approval
| Rule | Description |
|------|-------------|
| 0.1 | Activity type not in predefined list |
| 1.7 | Locked Existing JMP cashflow = 0 |
| 2.6 | JMP missing Hotel Guest target |
| 5.1 | < 2 zero-budget Ramadan activities per market |

### MEDIUM Severity — Flag for review
| Rule | Description |
|------|-------------|
| 1.1 | Budget increased >10% AND >AED 50K vs 2026 |
| 1.2 | Nov + Dec > 20% of annual cashflow |
| 1.4 | New JMP cashflow in signing year |
| 2.2 | JMP contract closes in Q4 |
| 3.1 | Activity type is "Others" |
| 3.8 | Activity missing KPIs (exempt: JMPs, GSA, Mission, Admin, Manpower) |
| 4.1 | Mega FAM target < 50 participants |
| 6.1 | 2 sales missions in same quarter |
| 6.3 | Exhibition with no revenue KPI |
| 8.4 | New non-JMP activity >AED 500K — no 2026 reference |
| B.1 | Cost efficiency outlier >15% above portfolio median |

### LOW Severity — Informational
| Rule | Description |
|------|-------------|
| 1.5 | Webinar has non-zero budget |
| 1.6 | Admin Miscellaneous line present |
| 3.2 | Duplicate: same name AND same type |
| 3.3 | Training/Workshop spans >1 month |
| 3.6 | Webinar at Priority 1 |
| 4.3 | FAM trip outside Feb–Jun window |

---

## Key Business Logic

### KPI Exempt Types (Rule 3.8)
All JMP types (New JMP, Existing JMP, Cruise JMP, and typo variants),
GSA Retainer Fee, Mission & Travel, Manpower, Admin, Projects, Expenses,
Stand Build, Hospitality

### Activity Type Buckets
- **JMPs**: New JMP, Existing JMP, Cruise JMP (and typo variants)
- **Trade Promotions**: FAM, FAM Trip, Mega FAM, Roadshow, Events/Workshops,
  Co-Host Industry Event, Travel Trade Partnership, etc.
- **All others**: shown individually with %

### VS Review Metrics
- **GSA Efficiency**: GSA Retainer Fee ÷ Total Market Budget × 100. Find median. Flag above median.
- **FAM Cost per Agent**: FAM cashflow ÷ FAM attendees. Find median. Informational.
- **Exhibition Opex/Revenue**: Exhibition cashflow ÷ Exhibition revenue. Per activity type. Find median per type.

### Hotel Guest Efficiency
- Cost per guest (total): All activities budget ÷ Hotel Guest targets
- Cost per guest (JMP): JMP budget only ÷ Hotel Guest targets
- Shown per region and per market

### Ramadan 2027
Feb 18 – Mar 20, 2027

---

## Predefined Activity Types (from AOP_Activities_KPIs.csv)
FAM, E-Learning, Roadshow, Events/WorkShops, Webinars, New JMP,
B2B PR FAM Trip, Exhibitions, Stakeholder Engagement, Mall Activation,
Existing JMP, B2B Comms, Expenses, Mission & Travel, GSA Retainer Fee,
Corporate Activation, Newsletter, Cruise JMP, B2C Conversion,
Content Partnership, Manpower, Projects, Admin, Mega FAM, Marketplace,
Travel Trade Partnership, Co-Host Industry Event, Stand Build, Space Rent,
Hospitality, Experience Abu Dhabi Workshop, Destination Sponsorship, Others

---

## Current Pain Points / What Needs Redesigning

1. **Visual design** is functional but not polished enough for Director-level review
2. **Story flow** needs to be stronger — should read like an executive briefing
3. **Market Review** needs richer analysis matching what Excel market tabs showed
4. **Calendar** needs the activity type filter + cashflow chart at bottom
5. **Violations** table needs to feel like an action centre, not just a list
6. **Overall** needs better colour hierarchy, typography, and data density

---

## Constraints
- Must remain pure HTML/CSS/JS — no framework, no build step, no server
- Must work offline after page load (except Google Fonts CDN)
- All files must be flat in the same directory (no subfolders) for GitHub Pages
- SheetJS and Chart.js loaded from CDN
- Target users are non-technical (Director + PMO) — must be intuitive
