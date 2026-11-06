# Test automation workflow

**Document version:** 2026-11-06
**Audience:** QA Engineers, Test Automation Team
**Purpose:** How a test case becomes a running mobile-web test, which layer
each piece of logic belongs in, and how a change is reviewed and reported.

---

## 1. The shape of the work

```
┌──────────────────────────────────────────────────────────────────┐
│                  TEST AUTOMATION WORKFLOW                        │
└──────────────────────────────────────────────────────────────────┘

  DESIGN                PLAN                 IMPLEMENT            REVIEW
  ════════              ════                 ══════════            ══════

  Test case         .claude/plans/        spec + POM +        typecheck +
  (a requirement    <date>-<slug>/         component +         device run
   from a ticket)   plan.md               service             reported honestly
        │                │                    │                    │
        ▼                ▼                    ▼                    ▼
   test-cases/      approved by          tests-mobile/         PR against
   ui/<f>.md        the requester        src/mobile/           main
```

Three phases, each with a **gate**: a plan is approved before it is
implemented, and a run is reported only after it has actually been executed.

---

## 2. Phase 1 — Design the test case

A test case is written **before** any automation, in black-box terms: what
the user does, and what the user sees.

```
Test Case: SHIP-3001 — a booked shipment appears in the shipment list
Tags:      @smoke @regression @shipment
Feature:   shipments_list
Pre:       signed in
Steps:     open the drawer → Shipments → Booked shipments
Expected:  the list renders, and the ids in it match the booked shipments
```

### Techniques used

| Technique | Where it earns its keep in this app |
|---|---|
| Equivalence partitioning | valid / invalid e-mail, blank vs filled password |
| Boundary value analysis | a very long address, an id at the page boundary |
| Decision table | wrong password × malformed e-mail — see the server/client matrix in [SHIPMONDO-APP.md](./SHIPMONDO-APP.md) |
| State transition | signed out → signed in → session expired |
| Error guessing | the demo tenant is not seeded — an empty list is a valid state |
| Exploratory | the drawer accordions, the condensed phone header |

### Automation decisions

| Decision | Meaning |
|---|---|
| `AUTOMATE_UI` | deterministic, user-visible, needs the browser — **the only automate-here category**, because this repository is a mobile-web UI suite |
| `MANUAL` | visual, exploratory, or usability — a human with a phone |
| `DEFER` | business logic that belongs to a backend/API suite, which this repository does not contain |

There is no `AUTOMATE_API` and no `AUTOMATE_DB` in this project. A case that
needs those is `DEFER` — with the reason recorded, not quietly dropped.

### The mobile adaptation is part of the design

A test case that would pass identically in a desktop browser does not belong
in this suite. Design it against the phone:

- the navigation is an off-canvas drawer, so *reaching* a route is three
  steps, not one;
- the account name lives behind the profile avatar, not in the top bar;
- the submit button sits behind the software keyboard.

---

## 3. Phase 2 — Plan, and get it approved

Anything beyond a trivial one-line change goes through a plan. The format and
the required sections are in
[.claude/rules/plan-before-implementation.md](../.claude/rules/plan-before-implementation.md);
the file lives at
`.claude/plans/<YYYY-MM-DD>-<task-slug>/plan.md`.

The plan states:

- the **objective** and the **requirements** it satisfies;
- the **assumptions** — anything the request did not specify, written down
  rather than silently decided;
- the **mobile adaptation** — touch vs mouse, viewport, drawer, keyboard;
- the **feature tag** the test will carry, and its status in
  [`config/test-policy.json`](../config/test-policy.json);
- the **files to touch**, the **steps**, the **edge cases**, the
  **integration impact**, the **testability**, the **non-functional impact**,
  the **alternatives** and the **risks**.

### The gate

The plan is presented and **explicit approval is required** before any code
is written. "Approved", "proceed" and "implement" are all approvals; silence
is not.

If a new requirement turns up during implementation, the implementation stops,
the plan is updated, and a material scope change is re-approved.

---

## 4. Phase 3 — Implement, in the right layer

### The four layers

```
Test (spec)  →  Fixtures (composition root)  →  POM / Component / Service  →  Selectors
```

| Layer | Path | May assert? | May know the DOM? |
|---|---|---|---|
| Test | `tests-mobile/**/*.spec.ts` | **yes** | only through the layers below |
| Fixtures | `src/mobile/fixtures/` | no | through the layers below |
| Page objects | `src/mobile/pages/` | no | yes |
| Components | `src/mobile/components/` | no | yes |
| Services | `src/mobile/services/` | no | through the browser |
| Selectors | `src/mobile/selectors.ts` | no | yes — this *is* the DOM knowledge |

**Zero assertions outside the test layer.** A page object that contains
`expect(...)` is wrong, however convenient it would be: it moves the decision
away from the place where the failure message can name what was expected.

### Where a given piece of logic belongs

| You want to… | Put it in |
|---|---|
| assert something | the spec |
| reuse a flow that several specs share | a fixture |
| describe one route | a page object in `src/mobile/pages/` |
| describe a region of the shell | a component in `src/mobile/components/` |
| talk to the app's own endpoints | a service in `src/mobile/services/` |
| locate something in the DOM | `src/mobile/selectors.ts` |

If a selector is needed in two places, it is a selector — in the selectors
file. Never inline a CSS or XPath string into a spec or a page object.

### The rules that hold everywhere

1. **No hard waits.** Every wait names the condition it waits for, has an
   explicit budget from `src/shared/env.ts`, and fails with a message that
   says what did not happen.
2. **Mobile-first interactions.** Taps, not clicks at coordinates; `setValue`,
   not key-by-key; `scrollIntoView` before a tap that the keyboard could
   cover; groups expanded outermost-first.
3. **Secrets never touch the command line.** Credentials come from
   `process.env`; the captured session cookies live in memory for the
   lifetime of a worker.
4. **`src/shared/` is the only cross-layer import path**, and it knows nothing
   about Shipmondo's DOM.

---

## 5. Writing the spec

### The shape

```ts
import { browser } from '@wdio/globals';
import { describeMobile, itMobile, Tags, featureTag, title, expect } from '../../src/shared';
import { collectFailures, expectNoFailures } from '../../src/shared/assertions';
import { useAuthenticatedApp, type AppContainer } from '../../src/mobile/fixtures';

describeMobile(title(3001, 'Shipmondo shipments'), {
    features: [featureTag('shipments_list')],
    tags: [Tags.SMOKE, Tags.MOBILE, Tags.UI],
}, () => {
    let app: AppContainer;

    beforeEach(async () => {
        app = await useAuthenticatedApp();
    });

    itMobile(title(3001, 'the booked shipments match the API'), {
        features: [featureTag('shipments_list')],
        tags: [Tags.SMOKE, Tags.MOBILE, Tags.UI],
    }, async () => {
        // arrange, act, assert
    });
});
```

Note what is **not** there: no import of `describe`, `it` or `beforeEach`.
They are the ambient Mocha globals — see
[MOBILE-WEB-GUIDE.md](./MOBILE-WEB-GUIDE.md) § 5.2.

### Several assertions in one test

When a test verifies several things and the reader wants *all* the failures,
not just the first, use the collector:

```ts
const failed = collectFailures([
    { name: 'id', actual: id, expected: /^\d+$/ },
    { name: 'status', actual: status, expected: 'booked' },
]);

expectNoFailures(failed, 'the booked shipment row does not match the API');
```

Each entry is checked, every mismatch is reported, and the test fails once
with all of them.

### The failure message

The message says what was expected, in the words of the requirement — not
"expected truthy, received undefined":

```ts
expect(name, 'the signed-in account name is not shown anywhere in the header').toBeTruthy();
```

This is why the `expect` adapter exists at all: WebdriverIO's `expect` is
Jest's, and Jest takes one argument. See
[MOBILE-WEB-GUIDE.md](./MOBILE-WEB-GUIDE.md) § 5.1.

---

## 6. Review checklist

Before a pull request opens:

- [ ] **Layering.** No assertion outside a spec; no selector outside
      `selectors.ts`; no DOM knowledge in `src/shared/`.
- [ ] **Mobile adaptation.** The test states what is different on a phone,
      and would not pass identically on a desktop.
- [ ] **Waits.** No `pause()`, no `setTimeout`, no sleep of any kind; every
      wait names its condition and carries a budget from `env.timeouts`.
- [ ] **Feature gating.** At least one `@feature:` tag, and that feature
      exists in `config/test-policy.json`.
- [ ] **Titles.** `title(<ticket>, '<what is verified>')`, plus suite tags.
- [ ] **Secrets.** No credential, cookie value or API key in the code, in a
      log, in an Allure attachment or in a commit.
- [ ] **Typecheck.** `npm run typecheck` is clean.
- [ ] **Device run.** The relevant platform run was executed — and the PR
      description says *which*.

---

## 7. Reporting

> **Never claim a suite passes unless you actually ran it and saw it pass.**

A report states:

1. the **exact command** that was run;
2. the **numbers** — passed, failed, skipped, and why each was skipped;
3. the **output** that matters — the failure message, the Allure link;
4. what was **not** run, and **exactly what is missing**.

If the simulator was not booted, that is the answer: *"`npm run test:ios` was
not run — no iPhone 17 simulator runtime is installed on this host. The
typecheck passed."* That is a complete and honest report. Inventing a green
run is not.

### When the product disagrees with the test

Keep the assertion on the **contract's** side. Let the test fail. Report the
drift with the expectation and the observation quoted side by side:

```
Expected: the booked shipments list shows the ids returned by the API
Observed: the list renders 0 rows while the API returns 12
```

Never weaken an assertion to make a run green. A weakened assertion is a
deleted test that still takes time.

---

## 8. Working with the agents

The `.claude/` tree carries the roles this repository uses:

| Agent | Role |
|---|---|
| `mobile-ui-test-automation` | writes and extends the mobile-web specs, the POM and the components |
| `test-automation-orchestrator` | turns a plan into chunks and routes them, one at a time, so each chunk reuses what the earlier ones built |
| `mobile-environment-audit` | checks whether the host can actually run the suite — and **installs nothing** |

The orchestrator runs chunks **strictly sequentially**, on purpose: a later
chunk must be able to read what the earlier chunks actually built rather than
rediscovering it.

---

## 9. A worked example

**Requirement:** *add a mobile-web test that a booked shipment's id in the list
matches the id the app's own endpoint returns.*

1. **Design.** One test case. Feature `shipments_list`. Tags `@smoke`,
   `@regression`, `@shipment`, `@mobile`. Mobile adaptation: the list is
   reached through the drawer, and the ids are read from the body table —
   not the header clone — with the checkbox column counted out.

2. **Plan.** `.claude/plans/2026-11-06-booked-shipment-id/plan.md` — the
   objective, the assumption that the demo tenant is not seeded (so the
   comparison is list-vs-endpoint, never list-vs-a-number), the files to
   touch (`tests-mobile/shipments/booked-shipments.spec.ts`, possibly
   `src/mobile/services/app-data.service.ts`), the steps, the edge cases and
   the risks. **Approved.**

3. **Implement.** The spec reads the body table's ids through the existing
   datatable component, and compares them with the ids the service returns
   from inside the browser.

4. **Review.** `npm run typecheck` clean; `npm run test:android` executed on
   the emulator; the PR description says exactly that.

---

## 10. Quick reference

| Question | Answer |
|---|---|
| Where does an assertion go? | The spec. Nowhere else. |
| Where does a selector go? | `src/mobile/selectors.ts`. |
| Where does a shared flow go? | A fixture in `src/mobile/fixtures/`. |
| How do I skip a test on a tenant? | `featureTag('<name>')`, with the feature disabled in the matrix. |
| How do I run only the smoke tests? | `--mochaOpts.grep "@smoke"`. |
| What is the timeout budget? | `env.timeouts` — never a literal. |
| Which `expect` do I import? | The one from `src/shared`. |
| Do I import `describe`/`it`? | No. They are ambient. |
| Can I install a simulator? | No. The framework never provisions its environment. |
