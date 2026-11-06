# logistics-shipmondo-mobile-testing

Mobile-web UI test framework for the **Shipmondo** shipping platform — TypeScript + WebdriverIO 9 + Appium 2.

The suite drives the Shipmondo **web app** in a **real mobile browser on a simulated device**:

| Platform | Browser | Device | Appium driver | Config |
| -------- | ------- | ------ | ------------- | ------ |
| **iOS** | Safari | iPhone 17 Simulator | `XCUITest` | [`wdio.ios.conf.ts`](./wdio.ios.conf.ts) |
| **Android** | Chrome | Samsung Galaxy Emulator | `UiAutomator2` | [`wdio.android.conf.ts`](./wdio.android.conf.ts) |

There is **no native app** under test and **no Playwright** in the stack. The
`browserName` capability is what makes the session a *mobile web* session:
Appium launches the device's own browser, and the suite asserts on the DOM that
browser renders.

> **The framework installs nothing.** Xcode, the iOS Simulator runtime, Android
> Studio, the Android system images and the Appium drivers are expected to
> exist on the host already. The repository only *describes* the target
> environments — see [docs/MOBILE-ENVIRONMENT-SETUP.md](./docs/MOBILE-ENVIRONMENT-SETUP.md).

---

## Documentation

See [`docs/`](./docs/) for the reference guides:

- [docs/INDEX.md](./docs/INDEX.md) — index of every document
- [docs/SHIPMONDO-APP.md](./docs/SHIPMONDO-APP.md) — the web app: routes, DOM facts, internal API
- [docs/MOBILE-WEB-GUIDE.md](./docs/MOBILE-WEB-GUIDE.md) — what "mobile web" means here, and how it differs from the desktop suite
- [docs/FEATURE-GATING-GUIDE.md](./docs/FEATURE-GATING-GUIDE.md) — how tests are gated per environment
- [docs/TEST-AUTOMATION-WORKFLOW.md](./docs/TEST-AUTOMATION-WORKFLOW.md) — how a test case becomes a test
- [docs/MOBILE-ENVIRONMENT-SETUP.md](./docs/MOBILE-ENVIRONMENT-SETUP.md) — what the host must provide before a run

[`CLAUDE.md`](./CLAUDE.md) holds the rules an AI agent must follow in this repository.

---

## Prerequisites

- **Node.js 20+**
- **iOS:** Xcode with an iPhone 17 simulator runtime, and the Appium `xcuitest` driver
- **Android:** Android Studio with a Samsung Galaxy system image and an AVD, and the Appium `uiautomator2` driver
- **Appium 2** (`npm run` starts its own server by default)

```bash
npm install
```

The framework never installs a simulator, an emulator, a system image or an
Appium driver. It targets environments that already exist.

---

## Configuration

```bash
cp .env.example .env
```

Then fill in:

| Variable                              | Needed by        | Purpose                                                        |
| ------------------------------------- | ---------------- | -------------------------------------------------------------- |
| `TEST_ENV`                            | all              | `demo` \| `staging` \| `release` — drives browser navigation    |
| `DEMO_BASE_URL`                       | all              | Base URL of the web app                                         |
| `SHIPMONDO_WEB_USER` / `_WEB_PASSWORD` | all             | Web app login credentials                                       |
| `SHIPMONDO_LOGIN_PATH`                | all              | Login page path (relative to the base URL)                      |
| `WDIO_APPIUM_SERVICE`                 | all              | `true` = the runner owns the Appium server, `false` = use your own |
| `APPIUM_HOST` / `APPIUM_PORT`         | all              | Where the Appium server listens                                 |
| `IOS_DEVICE` / `IOS_VERSION` / `IOS_UDID` | iOS           | Which simulator to drive                                        |
| `ANDROID_DEVICE` / `ANDROID_OS` / `ANDROID_UDID` | Android | Which emulator to drive                                  |
| `WAIT_FOR_DISPLAYED` / `_PAGE_LOAD` / `_SCRIPT` | all  | Timeout budgets, in milliseconds                                |
| `TICKET_PREFIX`                       | all              | Prefix in test titles (`SHIP-3001 \| what is verified`)         |

Never commit a filled-in `.env` — it is gitignored. In CI, set these as
pipeline variables.

### Two independent axes

`TEST_ENV` selects the **tenant** the mobile browsers navigate to. The
**device** is chosen by the *config file* you run — `wdio.ios.conf.ts` or
`wdio.android.conf.ts` — never by an environment variable, so a run can never
end up on a device it did not ask for. Resolution lives in
[`src/shared/env.ts`](src/shared/env.ts).

---

## Running tests

```bash
# One platform
npm run test:ios
npm run test:android

# Both, Android first (so a phone failure is visible before the simulator run)
npm run test:both

# Smoke only
npm run test:smoke:ios
npm run test:smoke:android

# TypeScript check
npm run typecheck
```

WebdriverIO's own CLI narrows a run further:

```bash
# One spec file
npx wdio run wdio.ios.conf.ts --spec tests-mobile/auth/login.spec.ts

# By selection tag (tags travel inside the Mocha title)
npx wdio run wdio.android.conf.ts --mochaOpts.grep "@smoke"
npx wdio run wdio.android.conf.ts --mochaOpts.grep "@negative"

# By feature tag
npx wdio run wdio.ios.conf.ts --mochaOpts.grep "@feature:orders"
```

### Allure

```bash
npm run allure:generate   # allure-results → allure-report
npm run allure:open
npm run allure:serve
```

A failing test leaves a screenshot of the device in `allure-results/`, so the
report shows what the phone actually displayed.

---

## Architecture

Every test follows the same four-layer flow:

```
Test (spec)  →  Fixtures (composition root)  →  POM / Component / Service  →  Selectors
```

Rules that hold everywhere:

- **Zero assertions** outside the test layer. Pages, components and services
  report state; specs decide whether it is correct.
- **No hard waits.** No `pause()`, no fixed sleeps. Every wait is anchored on a
  condition the app itself controls.
- **No secrets in code.** Credentials come from `process.env` only, and the
  session cookies live in memory for the lifetime of a worker.
- **`src/shared/` is the only cross-layer import path**, and it knows nothing
  about Shipmondo's DOM.

### Layer map

| Layer     | Path                                                    |
| --------- | ------------------------------------------------------- |
| Test      | `tests-mobile/**/*.spec.ts`                              |
| Fixtures | `src/mobile/fixtures/`                                   |
| Middle    | `src/mobile/pages/`, `components/`, `services/`          |
| Edge      | `src/mobile/selectors.ts`                                |

### Where the code lives

| Path                     | Contents                                                        |
| ------------------------ | --------------------------------------------------------------- |
| `src/shared/`            | Environment, tags, titles, feature gating, the `expect` adapter |
| `src/mobile/selectors.ts` | Every selector, verified against the live app                   |
| `src/mobile/pages/`      | One page object per route                                        |
| `src/mobile/components/` | The reusable shell regions (drawer, top bar, datatable, …)       |
| `src/mobile/services/`   | Sign-in, session replay, the app's own internal API              |
| `src/mobile/fixtures/`   | The composition root — `useAuthenticatedApp` / `useSignedOutApp`  |
| `tests-mobile/`          | The specs                                                         |
| `config/devices.ts`      | The device matrix — which handset, which browser                 |
| `config/test-policy.json`| The feature-gating matrix                                         |
| `wdio.*.conf.ts`         | The WebdriverIO configurations                                   |
| `.claude/`               | Agent definitions, project rules and skills                      |

---

## The `expect` adapter

The one genuine API difference between this framework and the desktop
Playwright suite it was ported from: Playwright's `expect` takes a second
argument — `expect(value, 'message')` — and WebdriverIO's (Jest's) does not.
Jest **throws** `Expect takes at most one argument.` for a second one.

[`src/shared/expect.ts`](src/shared/expect.ts) bridges the two:

```ts
expect(name, 'the account name is missing from the header').toBeTruthy();
```

The assertion behaves exactly like `expect(name).toBeTruthy()` while it passes,
and reports the message together with the original Jest diff when it fails.
The full explanation is in
[docs/MOBILE-WEB-GUIDE.md](./docs/MOBILE-WEB-GUIDE.md) § "Porting notes".

---

## Feature gating

Every test carries at least one `@feature:` tag. The matrix in
[`config/test-policy.json`](config/test-policy.json) decides whether that
feature is enabled in the current `TEST_ENV`:

- feature **disabled** in this env → the test is skipped with a reason;
- feature **absent** from the matrix → the test **fails loudly** (a typo must
  not silently disable coverage).

Selection tags (`@smoke`, `@regression`, `@negative`, …) are a separate axis,
chosen at the CLI and never gated. Full details:
[docs/FEATURE-GATING-GUIDE.md](./docs/FEATURE-GATING-GUIDE.md).

---

## Known gaps

| Gap                                                   | Impact                                                                    | Mitigation                                                                     |
| ----------------------------------------------------- | ------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| No `data-testid` in the DOM                            | Locators rely on ids, classes and XPath — more brittle than test ids        | Selectors live in one file and are documented against the real markup          |
| The demo tenant is not seeded                           | Some list assertions depend on data existing                                | The suite compares the rendered list against the backing API instead of counting |
| The app renders every list **twice** (header clone)     | A naive selector counts headers and rows twice                              | The list XPath addresses the body table only (`routeTableXPath`)                |
| The app's internal API needs a session cookie and a same-origin `Origin` | A plain `fetch` from the page is rejected         | Requests are issued from inside the browser (`AppDataService`)                  |
| The internal API is eventually consistent                | A read right after a write may miss the row                                  | The services poll for the row instead of assuming it is there                  |
| The framework cannot install its own devices            | A fresh host cannot run the suite without manual setup                      | Documented in [docs/MOBILE-ENVIRONMENT-SETUP.md](./docs/MOBILE-ENVIRONMENT-SETUP.md) |

---

## Contributing

- Branch on `feat/`, `fix/`, `test/`, `refactor/`, `chore/`, `docs/`, `hotfix/`
  — see [.claude/rules/git-flow-branching.md](.claude/rules/git-flow-branching.md).
- Plan before implementing — see
  [.claude/rules/plan-before-implementation.md](.claude/rules/plan-before-implementation.md).
- Every change stays mobile-first and free of hard waits — see
  [.claude/rules/appium-mobile-first.md](.claude/rules/appium-mobile-first.md)
  and [.claude/rules/no-hard-waits.md](.claude/rules/no-hard-waits.md).
- Run `npm run typecheck` and the relevant platform run before opening a PR.
  Report what actually ran; never claim a suite passes that you did not execute.
