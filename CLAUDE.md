# CLAUDE.md

Instructions for an AI agent working in this repository.

This file is the **contract**. If it conflicts with a habit you picked up
elsewhere, this file wins.

---

## 1. What this repository is

A TypeScript + **WebdriverIO 9 + Appium 2** test automation framework for the
**Shipmondo** shipping platform, driving the **web app** in a **real mobile
browser on a simulated device**.

| Platform | Browser | Device | Appium driver | Config |
|---|---|---|---|---|
| iOS | Safari | iPhone 17 Simulator | `XCUITest` | `wdio.ios.conf.ts` |
| Android | Chrome | Samsung Galaxy Emulator | `UiAutomator2` | `wdio.android.conf.ts` |

Three things follow from that, and they shape everything else:

1. **This is mobile *web* testing, not native-app testing.** There is no `app`
   capability; `browserName` is what hands the session to Safari or Chrome.
   Never write a native locator (`~XCUIElementTypeButton`, `UiSelector`) and
   never reach for an `adb`/`simctl` command in a test.
2. **Playwright is forbidden.** No `playwright`, no `@playwright/test`, no
   Playwright MCP tools, no `page.locator()`.
3. **The framework installs nothing.** Xcode, the simulator runtime, Android
   Studio, the system images and the Appium drivers are expected to exist on
   the host. The repository *describes* target environments; it never creates
   them.

Start with [`README.md`](README.md) for setup and
[`docs/INDEX.md`](docs/INDEX.md) for the reference material.

---

## 2. The four layers, and what belongs in each

```
Test (spec)  →  Fixtures (composition root)  →  POM / Component / Service  →  Selectors
```

1. **Zero assertions** outside the test layer. Pages, components and services
   *report*; the spec *decides*.
2. **Specs import their fixtures from `src/mobile/fixtures`**, and `expect`
   from `src/shared`. Never import `describe`/`it`/`beforeEach` from
   `@wdio/globals` — they are not exported there. They are the **ambient
   Mocha globals** (`@types/mocha`), installed on `globalThis` by Mocha's BDD
   interface and wrapped by WebdriverIO's Mocha framework.
3. **`src/shared/` is the only cross-layer import path**, and it knows nothing
   about Shipmondo's DOM. `src/mobile/` knows nothing about a spec.
4. **No hard waits.** No `browser.pause()`, no `waitForTimeout`, no
   `setTimeout` sleep. Wait on state — an element, a class, a URL, a row.

If a change needs an assertion in a page object, the change is wrong.

---

## 3. Environment axes

Two axes, deliberately independent:

- `TEST_ENV` (`demo` | `staging` | `release`) — drives **browser
  navigation** only.
- **The device** — chosen by the *config file* that is run, never by an
  environment variable, so a run can never end up on a device it did not ask
  for. `config/devices.ts` holds the profiles; the `wdio.*.conf.ts` files
  pick one.

**Secrets never touch the command line.** They come from `.env` (gitignored)
or from pipeline variables. Never print a credential, a session cookie value
or an API key to stdout, into a log, into an Allure attachment or into a
commit. The captured session cookies live **in memory only**, for the
lifetime of a worker.

---

## 4. Before you write a test

1. **Read the app.** [`docs/SHIPMONDO-APP.md`](docs/SHIPMONDO-APP.md) and
   [`docs/MOBILE-WEB-GUIDE.md`](docs/MOBILE-WEB-GUIDE.md). Do not guess a
   route, a class name, a selector or a viewport.
2. **Look for an existing layer.** A new selector belongs in
   `src/mobile/selectors.ts`; a new route belongs in `src/mobile/pages/`; a
   new shell region belongs in `src/mobile/components/`.
3. **Tag the test** with at least one `@feature:` tag that exists in
   `config/test-policy.json`, plus the selection tags that fit.
4. **State the mobile adaptation.** What is different on a phone than on a
   desktop? Off-canvas drawer instead of a fixed sidebar, touch instead of
   hover, a condensed header, the software keyboard over the submit button, a
   vertically scrolling list? A test that would pass identically on a desktop
   browser does not belong in this suite.
5. **Plan first.** See §5.

### 4.1 Assertions

Use the `expect` from `src/shared` — it accepts the Playwright-style
`expect(value, 'message')` and reports the message with the Jest diff when
the assertion fails:

```ts
expect(name, 'the account name is missing from the header').toBeTruthy();
```

Jest's own `expect` throws `Expect takes at most one argument.` for a second
argument, so a raw two-argument call is a **runtime** failure, not a typing
one. See [`docs/MOBILE-WEB-GUIDE.md`](docs/MOBILE-WEB-GUIDE.md) § "Porting
notes".

### 4.2 Locators in the Shipmondo DOM

The app carries **no `data-testid` attribute**. Locators rely on ids, classes
and XPath.

Three traps:

- **Every list renders its table twice** — a header-only clone with no `tbody`,
  and the body table. Address the body table only; use `routeTableXPath()`.
- **`:has()` is not reliable** across Appium's selector engines (XCUITest on
  iOS, UiAutomator2 on Android). The list XPath is used instead.
- **Column 1 of every list is the row-select checkbox column**, so the first
  *meaningful* column is column 2.

See [`docs/SHIPMONDO-APP.md`](docs/SHIPMONDO-APP.md).

### 4.3 Waiting for a route

`#content` carries a **route-specific class** that changes when the new view
is attached. The list rows arrive later, from the datatable XHR. The readiness
signal for a list route is therefore the route class **plus** a rendered
element — never the URL alone.

`routeContent()`, `routeTableXPath()` and the rest live in
[`src/mobile/selectors.ts`](src/mobile/selectors.ts). Use them; do not
hand-roll a selector.

### 4.4 Authenticating

The suite signs in **once per worker**, not once per test: the demo app is a
slow remote server, and one sign-in per test would cost the whole budget
several times over. The session cookies are captured in memory and replayed
into the browser before each test.

Wait for the **shell**, not just the URL. The URL flips to `#/dashboard`
before the AngularJS app renders; a fixture that resolves on the URL match
hands the test an empty page and every shell assertion fails.

### 4.5 Elements and element lists

WebdriverIO types `browser.$$` as a chainable array whose `length` is a
promise. Read a count through `countOf()` from
`src/mobile/components/base.component.ts` rather than through `.length`, and
resolve a list through `getElements()` before indexing it.

---

## 5. Plan before implementing

This applies to features, bug fixes, refactors, infrastructure changes and
test automation work — anything beyond a trivial one-line change.

1. **Clarify.** Use `AskUserQuestion` until the requirements are understood.
   Never replace a missing requirement with an assumption; if an assumption
   survives, write it into the plan.
2. **Plan.** Write `.claude/plans/<YYYY-MM-DD>-<task-slug>/plan.md` with the
   objective, requirements, assumptions, design, files to touch, steps, edge
   cases, integration impact, testability, non-functional impact,
   alternatives and risks.
3. **Present the plan and wait for explicit approval.**
4. **Implement.** If a new requirement turns up, stop, update the plan, and
   re-approve if the scope changed materially.

Full text: [.claude/rules/plan-before-implementation.md](.claude/rules/plan-before-implementation.md).

---

## 6. Branching

GitHub Flow: `main` is the stable branch; work happens on a branch that
merges back into `main` through a pull request.

```
<type>/<issue-id>-<kebab-case-description>
```

Types: `feat/`, `fix/`, `hotfix/`, `refactor/`, `chore/`, `docs/`, `test/`.
Lowercase, kebab-case, one logical change per branch. Full text:
[.claude/rules/git-flow-branching.md](.claude/rules/git-flow-branching.md).

---

## 7. Mobile-first, and never a hard wait

Every decision is a **mobile** decision: touch-sized targets, no hover-only
affordances, no mouse-only gestures, no fixed viewport. Full text:
[.claude/rules/appium-mobile-first.md](.claude/rules/appium-mobile-first.md).

Every wait is a **state** wait. Full text:
[.claude/rules/no-hard-waits.md](.claude/rules/no-hard-waits.md).

---

## 8. Reporting — the rule that matters most

**Never claim a suite passes unless you actually ran it and saw it pass.**

- Report the real command, the real numbers and the real output.
- If the suite could not run — because a simulator is missing, because an
  Appium driver is not installed, because a credential is absent — say so
  plainly and name exactly what is missing.
- A test that was never executed is not "probably fine". It is **not run**.
- Do not weaken an assertion to make a run green. If the product disagrees
  with the contract, keep the assertion on the contract's side, let it fail,
  and report the drift with the expectation and the observation quoted side
  by side.

---

## 9. Quality gates

Before opening a pull request:

```bash
npm run typecheck          # tsc --noEmit, strict, zero errors
npm run test:ios           # needs a booted iPhone 17 simulator + the xcuitest driver
npm run test:android       # needs a running Samsung Galaxy emulator + the uiautomator2 driver
```

Then state, in the PR description, **which of those you actually ran**.

A device run takes minutes and needs a simulator; if one was not available,
say so. `npm run typecheck` is always runnable and is never a substitute for
a device run — it only proves the code compiles.

---

## 10. Known gaps — do not paper over them

| Gap | Consequence |
|---|---|
| No `data-testid` in the DOM | Locators are more brittle than test-id based ones; every selector is documented against the real markup |
| The demo tenant is not seeded | Some list assertions depend on data existing; the suite compares the rendered list against the backing API instead of counting rows |
| The app's internal API needs a session cookie, an `X-Requested-With` header and a same-origin `Origin` | A plain `fetch` from the page is rejected; requests are issued from inside the browser |
| The internal API is eventually consistent | A read right after a write may miss the row; the services poll instead of assuming |
| The framework cannot install its own devices | A fresh host cannot run the suite without manual setup |

Full list: [`README.md`](README.md) § "Known gaps".
