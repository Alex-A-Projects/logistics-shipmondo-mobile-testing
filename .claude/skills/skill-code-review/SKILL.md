---
name: skill-code-review
description: "Review changes in the Shipmondo mobile-web test suite against this project's architecture rules, quality standards and anti-patterns — TypeScript with WebdriverIO v9, Appium 2, Mocha and Allure. Use after development to catch violations before merging: type safety, zero assertions in the POM layers, no hard waits, declared feature tags, ticket-prefixed titles, mobile-first interactions and no secrets in artefacts."
disable-model-invocation: false
---

You are a senior test automation engineer performing a code review. Your job is to identify violations of **this project's** rules — not general style preferences.

---

## Step 1 — Collect the change

```bash
git diff main...HEAD --name-only   # the changed files
git diff main...HEAD               # the full diff
```

If `$ARGUMENTS` is a file path or a glob, scope the review to those files. Otherwise review every changed file on the branch.

**Read each changed file in full** before reviewing it. A diff hides the context that decides whether a rule was broken — whether an `expect` in a page object is a leftover from a spec, whether a wait is a state wait or a sleep in disguise.

---

## Step 2 — Classify the files

| Path | Layer | The rules that apply |
|---|---|---|
| `tests-mobile/**/*.spec.ts` | Test | tags, ticket titles, `expect` placement, failure messages, no selectors |
| `src/mobile/pages/**` | Page Object | zero assertions, route-scoped ready selector, no sleeps |
| `src/mobile/components/**` | Component | zero assertions, no sleeps, selectors come from `src/mobile/selectors.ts` |
| `src/mobile/services/**` | Service | zero assertions, no page imports, no secrets |
| `src/mobile/fixtures/**` | Fixture | provides, never asserts |
| `src/mobile/selectors.ts` | Selector | no logic, one place for every DOM reference |
| `src/shared/**` | Shared | the vocabulary; `process.env` only in `env.ts` |
| `config/**`, `wdio.*.conf.ts` | Configuration | the feature matrix, the device matrix, the timeouts |

---

## Step 3 — Review

### CRITICAL — blocks the merge

**Type safety**

- `any` anywhere. The project is `strict` with `noUnusedLocals`, `noUnusedParameters`, `noImplicitOverride` and `noImplicitReturns`.
- A function with an explicit return type on one path but not another.
- A missing `override` keyword on a method that overrides a base-class member.
- `npm run typecheck` does not pass. Run it — do not infer it.

**Layer boundaries**

- An `expect` outside `tests-mobile/`. This is the rule the framework exists to enforce: an assertion inside a page object produces a failure message about a locator instead of about the behaviour.
- A selector literal in a spec file (`browser.$('#content')`).
- A service importing a page object for a purpose other than driving a real form.
- A component or a service importing from `tests-mobile/`.

**Feature gating**

- A `featureTag()` whose name is not declared in `config/test-policy.json` for the current env. An undeclared feature **fails the run at collection time**; it is a defect, not a skip.
- A feature that is declared but `false` in the matrix, used by a test that is expected to run.

**Secrets**

- A credential, a token or an API key as a string literal.
- A credential read from a place other than `process.env` (via `src/shared/env.ts`).
- A secret printed to the console, written to a file, or attached to an Allure report.
- The session cookies written to disk or exported to an artefact.
- A real value in `.env.example` instead of a placeholder.

**Hard waits**

- `browser.pause(...)`, `setTimeout`, or a `sleep` of any kind in a spec, a page object, a component or a service.

### MAJOR — should be fixed before the merge

**Titles and tags**

- A test title that is not `SHIP-<number> | what is verified`. The description must state what is *verified*, not what is clicked.
- A test with no execution-tier tag, or without `Tags.MOBILE`.
- A selection tag written as an inline literal (`'@smoke'`) instead of the `Tags` constant.

**Mobile-first interactions**

- A hover step. There is no hover on a touch screen.
- A navigation step that assumes a permanent sidebar. The navigation is an off-canvas drawer: open it, expand the owning group outermost-first, then tap the link.
- A sign-out or account-menu step that assumes the account name is in the header. On a phone it is behind the profile avatar.
- A typing step that sends characters one by one into a field the software keyboard covers. Use `setValue`, and scroll the control into view before tapping it.
- An assertion on a pixel position, or on a hover-revealed value.

**Wait correctness**

- A `waitUntil` without a `timeoutMsg` — the default message does not say what was being waited for.
- A route-agnostic ready selector (`#content`). The SPA swaps the content region in place, so it matches the *previous* route and makes the wait a no-op.
- A CSS `:has()` selector. Appium's selector engines (XCUITest, UiAutomator2) do not implement it consistently.
- A list selector that addresses the header-only clone of the table instead of the body table.

**Failure messages**

- An `expect` without a diagnostic message where the failure would otherwise be cryptic. Use the `expect(value, message)` adapter from `src/shared/expect.ts`.
- A `collectFailures` / `expectNoFailures` block used to swallow a broken precondition. The pattern is for independent checks, not for hiding a failed act.

**Hardcoded live data**

- A shipment id, an order number, a row count or a badge number written into a spec as a fixed expectation. The tenant is live; compare against the endpoint instead.

### MINOR — worth doing

- An unused import or an unused local — `noUnusedLocals` makes both a build error, but a reviewer should still point them out.
- A duplicated selector that already exists in `src/mobile/selectors.ts`.
- A missing mobile-adaptation note in the class comment of a new page object or component.
- A test that depends on a previous test having run.
- An `it.only` in a committed file.
- A `browser.url()` re-issued to the route the browser is already on — `BasePage.goto()` skips it deliberately.
- A new environment variable that is not documented in `.env.example`.

---

## Step 4 — Verify the mechanical checks

Run these rather than guessing:

```bash
npm run typecheck
```

```bash
# every feature tag used in the specs must exist in the matrix
grep -rho "featureTag('[a-z_]*')" tests-mobile | sort -u
```

```bash
# no hard waits, no assertions outside the spec layer
grep -rn "browser.pause\|setTimeout" tests-mobile src/mobile
grep -rn "expect(" src/mobile/pages src/mobile/components src/mobile/services
```

```bash
# no credentials as literals
grep -rn "password\s*=\s*['\"]" tests-mobile src
```

---

## Step 5 — Report

Group the findings by severity and reference `file:line` so the author can navigate directly.

```
## CRITICAL — Blocks Merge
[src/mobile/pages/orders.page.ts:64] expect() inside a page object
  > if (await rows.length > 0) { expect(rows[0].id).toBeGreaterThan(0); }
  Fix: return the ids and move the comparison into tests-mobile/orders/orders.spec.ts.

## MAJOR — Should Fix Before Merge
[tests-mobile/orders/orders.spec.ts:38] test title is not ticket-prefixed
  > itMobile('renders order ids in the first column', ...)
  Fix: use title(3303, 'renders order ids in the first column').

## MINOR — Nice to Have
[src/mobile/pages/dashboard.page.ts:41] selector duplicated from src/mobile/selectors.ts
  Fix: import the constant instead of repeating the literal.

---
## Summary
Files reviewed: 6
Critical: 1  |  Major: 1  |  Minor: 1
Verdict: FAIL
```

**The verdict is PASS only when Critical = 0 and Major = 0.**

Omit any severity section with no findings. Findings that are already correct must not be mentioned — the report is a list of defects, not a summary of the code.
