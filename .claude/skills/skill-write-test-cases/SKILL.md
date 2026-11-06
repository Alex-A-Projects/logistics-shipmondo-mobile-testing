---
name: skill-write-test-cases
description: "Design mobile-web test cases for the Shipmondo demo platform running inside a phone-sized browser (Safari on an iPhone 17 simulator, Chrome on a Samsung Galaxy S25 emulator). Produces test cases that carry a ticket-prefixed title (SHIP-3001 | what is verified), a declared feature tag from config/test-policy.json, an explicit mobile-adaptation note, preconditions, steps and an observable expected result. Uses black-box (equivalence partitioning, BVA, decision table, state transition, domain analysis, use case, pairwise), white-box (statement/branch/path/condition/loop coverage) and experience-based (error guessing, exploratory, checklist) techniques to adapt a desktop scenario to a mobile screen."
disable-model-invocation: false
---

You are a test design expert for **mobile web** automation. Given a feature, user story, screen or existing desktop scenario in `$ARGUMENTS`, design test cases that can be executed by a finger on a phone, then record the automation decision for each case.

The subject under test is the Shipmondo **web** application rendered by a **mobile browser** — Safari on an iPhone 17 simulator (XCUITest) and Chrome on a Samsung Galaxy S25 emulator (UiAutomator2). There is no native app in scope, no API suite in this repository and no database suite in this repository.

---

## Quick Reference

| I want to... | Do this |
|---|---|
| Find the feature name a case may use | Read `config/test-policy.json` — the `features` map of the current `TEST_ENV` |
| See the ticket title format | `title(3001, 'what is verified')` from `src/shared/titles.ts` |
| See which tags exist | `Tags` and `featureTag()` from `src/shared/tags.ts` |
| Know what the phone changes | "Adapt a desktop scenario to mobile" below, and `src/mobile/selectors.ts` |
| Implement the cases afterwards | `skill-implement-mobile-ui-test-automation` |

---

## Workflow

### Step 0 — Locate the input

Accept input from `$ARGUMENTS`:

- a **feature or screen** ("the shipments list", "the API access settings")
- a **user story** ("As a warehouse operator I want to see the drafts I prepared")
- an **existing desktop scenario** to adapt ("the desktop suite's SHIP-3203")
- a **directory path** to existing specs under `tests-mobile/`
- or, if the cases already exist, go straight to Step 6 (automation decisions).

---

### Step 1 — Analyse

Read the relevant source before designing anything:

- `src/mobile/selectors.ts` — the verified selectors, and the notes on the double-rendered tables and the off-canvas drawer.
- `src/mobile/pages/*.page.ts` — the routes that exist and what each one exposes.
- `src/mobile/components/*.component.ts` — the shell regions (sidebar drawer, condensed top bar, datatable, flash message, mobile shell).
- `tests-mobile/**/*.spec.ts` — the cases that already exist, so the new ones complement rather than duplicate them.
- `config/test-policy.json` — the feature names that may be used.
- `config/devices.ts` — the two device profiles and their viewports.

Establish, for the feature under test:

- the happy path and every error path the app actually has;
- the state the user must be in before the case starts (signed in, signed out, on a given route);
- which values are **stable business rules** (column names, route fragments, header labels) and which are **live tenant data** (row counts, ids, badges). Only the first kind may be written into a case as an expectation.
- the parts of the desktop scenario that **do not survive on a phone** — see "Adapt a desktop scenario to mobile".

---

### Step 2 — Select and apply techniques

**Black-box** — inputs and outputs only:

- **Equivalence partitioning** — group inputs into accepted and rejected classes (a malformed address versus a well-formed one).
- **Boundary value analysis** — test at the limits of a length, a count or a range.
- **Decision table** — cover every meaningful combination of conditions (empty password versus malformed address).
- **State transition** — cover the valid and invalid paths through a state (signed out → signed in → signed out).
- **Domain analysis** — test correlated values together.
- **Use case** — main flow, alternative flows, exception flows.
- **Pairwise** — cover every parameter pair that can interact.

**White-box** — with knowledge of the app's own structure:

- **Statement / branch / path / condition / loop coverage** over the behaviours the app implements (the client-side validator versus the server-side rejection of a wrong password).

**Experience-based**:

- **Error guessing** — the software keyboard swallowing a character, the drawer still being closed when a leaf link is tapped, the account name hidden behind the profile avatar.
- **Exploratory** — a short, time-boxed pass over the screen when the requirement is thin.
- **Checklist-based** — the mobile adaptation checklist below.

---

### Step 3 — Declare the feature tag and the selection tags

**Every case must declare exactly one feature tag that already exists in `config/test-policy.json`.**

Read the `features` map for the environment under test:

```json
{
  "envs": {
    "demo": {
      "features": {
        "auth": true,
        "dashboard": true,
        "shipments_list": true,
        "shipments_drafts": true,
        "orders": true,
        "address_book": true,
        "api_access": true,
        "account_settings": true,
        "mobile_web": true,
        "mobile_navigation": true
      }
    }
  }
}
```

A feature name that is **absent** from the matrix is a defect, not a skip: the suite throws at collection time so a typo can never silently disable a test. If a case needs a feature that is not in the matrix, say so in the report and let the feature be added to `config/test-policy.json` first.

Alongside the feature tag, choose selection tags from `src/shared/tags.ts`:

- **Execution tier** — exactly one of `@smoke`, `@sanity`, `@regression`, `@critical`.
- **Coverage type** — `@negative`, `@boundary`, `@security`, `@accessibility` where they apply.
- **Domain area** — `@auth`, `@shipment`, `@order`, `@address`.
- **Mobile axes** — `@mobile` on every case in this repository, `@responsive` on every case that asserts something about the layout or the viewport.

Rules:

- A case that asserts a rejection gets `@negative`.
- A case that asserts a value at a limit gets `@boundary`.
- Every case carries `@mobile`.
- `@critical` implies `@smoke` as well.

---

### Step 4 — Write the case

Each case follows the template below. Every field is mandatory.

```markdown
## SHIP-3204 | the shipment list renders one row per booked shipment

**Feature tag:** `@feature:shipments_list`
**Selection tags:** `@regression @shipment @mobile`
**Technique:** Equivalence partitioning
**Screen:** Shipments (`#/shipping-labels`)
**Preconditions:** The mobile browser is signed in to the Shipmondo demo tenant; the shipments route is open; the list has finished loading its rows.
**Mobile adaptation:** The list is a wide table inside a horizontally scrollable region on a phone, so the row values are read from the DOM rather than from their on-screen position. The route is reached through the off-canvas drawer, not through a permanent sidebar.
**Steps:**
1. Open the navigation drawer and tap "Shipments".
2. Wait until the route's own table has rendered at least one row.
3. Read the ids of the rendered rows.
**Expected result:** At least one row is rendered and every rendered id consists only of digits.
**Test data:** None — the ids come from the live tenant.
```

Field rules:

| Field | Rule |
|---|---|
| **Title** | `SHIP-<number> \| what is verified`, matching `title(3204, '…')`. The number is the ticket. The description states the verified outcome, not the action. |
| **Feature tag** | `@feature:<name>` with `<name>` present in `config/test-policy.json`. |
| **Selection tags** | From `Tags`; at least one execution tier plus `@mobile`. |
| **Technique** | The design technique that justifies the case. |
| **Screen** | The route or screen, e.g. `#/shipping-labels`. |
| **Preconditions** | Explicit and complete. A step must never repeat the action that establishes a precondition. |
| **Mobile adaptation** | What is different on a phone and how the case accounts for it. Never "same as desktop". |
| **Steps** | Numbered, one user action per line, in the order the user performs them. |
| **Expected result** | Observable and measurable. Never "the page works". |
| **Test data** | Concrete values, or an explicit statement that the tenant's live data is used. |

---

### Step 5 — Adapt a desktop scenario to mobile

A desktop scenario is **not** a mobile scenario until it has been through this list. Go through it point by point and record the outcome in the case's **Mobile adaptation** field.

**5.1 The navigation is an off-canvas drawer.**
On a phone the left navigation (`#left-panel`) is parked outside the viewport behind a hamburger toggle (`#hide-menu`), and the shell marks the open state with `body.mobile-view-activated`. A desktop step "click the link in the sidebar" becomes "open the drawer, expand the owning group if the link is a leaf, tap the link". The link may also sit several groups deep — the groups behave like an accordion, so they must be expanded outermost first.

**5.2 There is no hover.**
Hover menus, hover tooltips and hover-only rows do not exist on a touch screen. Any desktop step that reveals something by hover must be rewritten as a tap, or the case is dropped. If a value is only reachable through a hover, verify it through the app's own JSON API from inside the browser instead.

**5.3 The layout depends on the viewport.**
The viewport is 402×874 CSS pixels on the iPhone 17 profile and 393×852 on the Samsung Galaxy S25 (`config/devices.ts`). Cards stack in one column, tables scroll horizontally, and content that was side by side on a desktop is stacked. A desktop assertion about position ("the link is in the right-hand column") is meaningless here; assert the presence, the text or the order instead. Never assert a pixel position.

**5.4 The software keyboard covers the lower half of the screen.**
On a focused input the keyboard hides whatever is at the bottom — typically the submit button. Type with a single atomic assignment rather than key by key, and scroll the control into the centre of the viewport before tapping it. If the submit is still not reachable, dismiss the keyboard first.

**5.5 The header is condensed.**
The account name is hidden behind the profile avatar (`#mobile-profile-img`), which opens a dropdown. A desktop step "read the account name from the header" becomes "open the profile menu, then read the name from the dropdown". The environment badge is only rendered in demo mode; elsewhere its absence is the correct outcome, not a failure.

**5.6 A closed drawer is still "displayed".**
An off-canvas element reports `isDisplayed() === true` while it sits outside the viewport. Reachability must be decided from the element's rectangle relative to the viewport, never from its display state.

**5.7 One device at a time.**
The suite runs a single device at a time (`maxInstances: 1`). A case that would need two devices in parallel is out of scope.

**5.8 The viewport can change at runtime.**
Opening the keyboard or rotating the device resizes the viewport. The shell must survive it, and a case that resizes the window must assert that the content region is still displayed afterwards.

---

### Step 6 — Score and decide the automation layer

For each case, score nine dimensions from 0 to 5:

1. **Business criticality** — is this a flow the customer would notice losing?
2. **Replaceability** — can the behaviour be verified without a mobile browser at all?
3. **Stability** — does the DOM, the flow and the data hold still?
4. **Flakiness risk** — timing, animations, network latency, keyboard races, drawer races.
5. **Execution frequency** — smoke, regression or nightly.
6. **Maintenance cost** — selector stability and setup complexity.
7. **External dependency complexity** — third parties, remote server latency, the demo tenant's state.
8. **Feature volatility** — how likely the feature is to change or disappear in the target environment.
9. **Interaction complexity** — gestures, multi-step navigation, drawer expansion, keyboard interaction.

Decision rules:

- **AUTOMATE_MOBILE** when business criticality ≥ 4, replaceability ≥ 3, stability ≥ 3, flakiness risk ≥ 3, external dependency ≥ 3, feature volatility ≥ 3 and interaction complexity ≤ 3.
- **DO NOT AUTOMATE** when any of replaceability, stability, flakiness risk, external dependency or feature volatility is ≤ 2.
- **MANUAL** when the case is about usability, visual polish, layout aesthetics or exploratory discovery.
- **DEFER** when the requirement is unclear, the feature is unstable, the tenant data cannot be guaranteed, or the case belongs to an API- or data-level suite that this repository does not contain.

If the scoring is genuinely inconclusive, choose **DEFER**. A flaky mobile test is worse than no mobile test: the suite runs against a remote tenant, over a device link, at a mobile viewport.

---

### Step 7 — Save the file

```
test-cases/mobile/<feature>.md
```

One file per feature, kebab-case. The file contains:

1. A header with the techniques applied, the coverage type and the target environment.
2. The cases in order, separated by `---`.
3. A **Coverage and assumptions** section at the end, listing what was not covered and why.

---

### Step 8 — Verify and report

Checklist before reporting done:

- [ ] Every case carries a feature tag that exists in `config/test-policy.json`.
- [ ] Every case carries at least one execution-tier tag and `@mobile`.
- [ ] Every title is `SHIP-<number> | what is verified`.
- [ ] Every case has an explicit mobile-adaptation note.
- [ ] Preconditions are explicit and no step repeats them.
- [ ] Every expected result is observable.
- [ ] No live tenant value (a row count, a specific id, a badge number) is hardcoded as an expectation.
- [ ] The desktop scenario has been walked through the mobile adaptation list point by point.
- [ ] Every case has an automation decision and a reason.

Report back:

- the number of cases and the file created;
- the techniques applied and why they justify the case count;
- the feature tags and selection tags used, with their distribution;
- the automation decision breakdown (AUTOMATE_MOBILE / MANUAL / DEFER);
- the mobile adaptation points that changed a case's steps or its expected result;
- the coverage gaps and the assumptions that were made;
- the next step — `skill-implement-mobile-ui-test-automation` for the AUTOMATE_MOBILE cases.

---

## Quality standards

- **One behaviour per case.** A case that verifies three things is three cases.
- **Concrete expectations.** "The list is populated" is not an expectation; "at least one row is rendered and every id is numeric" is.
- **No hardcoded live data.** Row counts, ids and badge numbers come from the tenant at run time. Only stable rules — route fragments, column headers, error wording — are written down.
- **Explicit preconditions.** Never assume a state the case did not establish.
- **Mobile adaptation is never empty.** "None needed" is an acceptable answer only when the case genuinely touches nothing that a phone changes.
- **Technique-driven.** The number of cases follows from the techniques used, not from a target.
- **Documented gaps.** Say what was not covered.

---

## Anti-patterns

- A case that only says "the page loads".
- A step that says "hover over the row" — there is no hover on a phone.
- A case that hardcodes a shipment id or an order number that existed when the case was written.
- A feature tag invented for a case and never added to `config/test-policy.json`.
- A title without a ticket number.
- A desktop scenario copied across without the mobile adaptation pass.

---

## Next steps

1. Review the decisions with the team — business criticality is a judgement call.
2. For the **AUTOMATE_MOBILE** cases, call `skill-implement-mobile-ui-test-automation` to scaffold the spec, the page object and the selectors.
3. For the **MANUAL** cases, record them in the test plan or the README.
4. For the **DEFER** cases, revisit when the requirement or the tenant data stabilises.
