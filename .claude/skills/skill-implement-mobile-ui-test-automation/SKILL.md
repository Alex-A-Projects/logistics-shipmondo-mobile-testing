---
name: skill-implement-mobile-ui-test-automation
description: "Scaffold, implement or review the Shipmondo mobile-web test suite — TypeScript, WebdriverIO v9, Appium 2, Mocha and Allure, driving the Shipmondo web app in Safari on an iPhone 17 simulator and Chrome on a Samsung Galaxy S25 emulator. Follows the layered architecture (spec → fixture → page/component/service → selectors), the feature-gating rules of config/test-policy.json, the ticket-prefixed title format and the mobile-first quality standards. Use when asked to build, extend or review the mobile-web UI test framework or a new spec, page object, component or service."
disable-model-invocation: false
---

You are a senior mobile UI automation engineer. Given `$ARGUMENTS` (a feature, a screen, a flow, or "scaffold"), implement or extend the Shipmondo **mobile-web** suite following the rules below.

The suite drives the Shipmondo **web** application inside a **phone-sized browser** — Safari on an iPhone 17 simulator (XCUITest) and Chrome on a Samsung Galaxy S25 emulator (UiAutomator2), both through Appium 2. There is no native app under test, no API suite and no database suite in this repository.

---

## Step 0 — Feature gate

**Mandatory, and it runs before any code is written.**

1. Read `config/test-policy.json` and look at the `features` map of the environment under test (`TEST_ENV`, default `demo`).
2. Identify the feature the work depends on.
3. Decide:
   - The work depends on no gated feature → confirm that and continue.
   - The feature exists in the matrix → confirm its exact name and continue.
   - The feature is **missing** from the matrix → **stop**. Do not write code. Report:
     ```
     Feature '<name>' is not declared in config/test-policy.json for env "<env>".
     Add it to the matrix with the correct true/false value, then re-run this skill.
     ```
     A missing feature is a loud failure at collection time (`src/shared/mocha.ts`), not a silent skip — a typo in a feature tag must never quietly disable a test.

The confirmed feature name must appear as `featureTag('<name>')` on every `describeMobile` and `itMobile` that touches it.

---

## Step 1 — Orient

Read the real code before writing anything:

- `src/shared/` — `env.ts`, `expect.ts`, `assertions.ts`, `mocha.ts`, `policy.ts`, `tags.ts`, `titles.ts`, `paths.ts`, `generators.ts`.
- `src/mobile/` — `selectors.ts`, `pages/`, `components/`, `services/`, `fixtures/`, `models/`.
- `tests-mobile/**/*.spec.ts` — the existing cases and the conventions they follow.
- `config/devices.ts`, `config/test-policy.json`.
- `wdio.shared.conf.ts`, `wdio.ios.conf.ts`, `wdio.android.conf.ts`.

Then decide which layer needs work: the spec, the fixture, the page object, the component, the service, the selector, or the policy matrix.

---

## Reference index

| I want to... | Reference file |
|---|---|
| Understand the layer model and the dependency rules | `references/architecture.md` |
| Write a spec — `describeMobile` / `itMobile`, tags, titles, the `expect` adapter, failure collection | `references/test-layer.md` |
| Wire the fixtures — `useAuthenticatedApp`, `useSignedOutApp`, the worker session replay, `browser.app` | `references/fixtures-layer.md` |
| Write a page object or a component — zero assertions, condition-based waits, new routes and shell regions | `references/pom-layer.md` |
| Write a service — `AuthService`, `AppDataService` and the app's internal JSON API | `references/service-layer.md` |
| Configure the environment — `src/shared/env.ts`, `.env`, `TEST_ENV`, timeouts, the Appium service, the two platform configs | `references/environment.md` |
| Check the work against the review checklist | `references/quality-rules.md` |
| Run the suite and read the report | `references/verify-report.md` |
| Add a new spec, page and selectors from scratch | `references/scaffold.md` |

`references/architecture.md` merges the source project's separate design-patterns guide into the layer model, since the patterns that matter here (the composition root as a Facade, the container as a Factory, the device profile as a Strategy) are all expressed through the layers themselves.

---

## The layer model in one page

```
tests-mobile/<area>/<feature>.spec.ts
        ↓  imports
src/mobile/fixtures/index.ts        useAuthenticatedApp() / useSignedOutApp()
        ↓  returns
src/mobile/fixtures/app-container.ts  AppContainer { pages, components, services }
        ↓
src/mobile/pages/      src/mobile/components/      src/mobile/services/
        ↓                     ↓                        ↓
src/mobile/selectors.ts   the verified DOM contract  the app's own JSON API
```

The rules that make the model hold:

- **The spec layer** holds the assertions, the tags and the ticket titles. It never touches a selector.
- **The fixture layer** is the single composition point. WebdriverIO has no fixture-injection arguments, so the fixtures are functions a spec calls from its own `beforeEach` and keeps the returned container.
- **The POM and component layers** expose state and perform actions. **Zero assertions.** Verification lives in the spec, so the failure message belongs to the behaviour that failed.
- **The service layer** talks to the app's own internal JSON API from inside the mobile browser. It never imports a page object.
- **The selector layer** is the only place that knows the DOM.

---

## Quality standards

Non-negotiable:

- No hard waits. Every wait is a state wait — `waitForDisplayed`, `waitForExist`, `waitUntil` with a condition.
- No assertions in a page object, a component or a service.
- No hardcoded credentials. Everything comes from `process.env` through `src/shared/env.ts`.
- No secrets in any artefact — screenshots, attachments, console output.
- Every test declares a feature tag that exists in `config/test-policy.json`.
- Every test title is `SHIP-<number> | what is verified`, produced by `title()`.
- Every test is independent of the order it runs in.
- TypeScript strict mode, `noUnusedLocals`, `noImplicitOverride`, `noImplicitReturns`.

Anti-patterns to avoid: global mutable state, assertions in the POM layer, mixing the DOM and the API in the same layer, sleeps dressed up as waits, and abstractions that wrap WebdriverIO for no reason.

---

## Implementation workflow

1. **Orient** — read the existing code.
2. **Gate** — confirm the feature name against the policy matrix.
3. **Layer** — decide which layer the change belongs to; write it there.
4. **Implement** — in the order spec, fixture, page, component, service, selector.
5. **Verify** — `npm run typecheck`, then the targeted spec on a device.
6. **Report** — files touched, cases added, feature tags used, commands run.

---

## Environment at a glance

`src/shared/env.ts` is the only module that reads `process.env`. It resolves two independent axes:

- **UI environment** — `TEST_ENV` (`demo`, `staging`, `release`) selects the base URL and nothing else.
- **Device environment** — the *config file* selects the device: `wdio.ios.conf.ts` or `wdio.android.conf.ts`. A run can never end up on a device it did not ask for.

`npm run test:ios` and `npm run test:android` are the entry points; `npm run test:both` runs Android then iOS. The Appium server is started and stopped by WebdriverIO unless `WDIO_APPIUM_SERVICE=false`.

---

## Verification

```bash
npm run typecheck                          # type safety, no emit
npm run test:ios -- --spec tests-mobile/auth/login.spec.ts
npm run test:android -- --spec tests-mobile/auth/login.spec.ts
npm run test:smoke:ios                     # the @smoke set
npm run allure:serve                       # the report
```

`references/verify-report.md` covers the full workflow: how to run a single spec, how to run a tag, how the failure screenshot is captured, and how to read a mobile failure.

---

## Reference files

Every reference file in `references/` is a self-contained guide to its topic, written against the real APIs of this repository. Consult them for the code examples, the anti-patterns and the debugging checklists.
