# Documentation index

Every document in this repository, and what it is for.

---

## Reference

| Document | What it answers |
|---|---|
| [SHIPMONDO-APP.md](./SHIPMONDO-APP.md) | What the **web app** actually looks like: routes, the route-content class, the two-table list structure, the off-canvas drawer, the internal API and its same-origin rules. Read this before writing a locator. |
| [MOBILE-WEB-GUIDE.md](./MOBILE-WEB-GUIDE.md) | What "mobile web" means for this suite: the device profiles, the touch and viewport differences, the mobile adaptations of the desktop scenarios — and the API differences a Playwright suite has to be ported across. |
| [FEATURE-GATING-GUIDE.md](./FEATURE-GATING-GUIDE.md) | How a test is enabled or skipped per environment: the `@feature:` tag, the matrix in `config/test-policy.json`, and why an undeclared feature fails loudly. |
| [TEST-AUTOMATION-WORKFLOW.md](./TEST-AUTOMATION-WORKFLOW.md) | How a test case becomes a test: the four layers, where a given piece of logic belongs, the review checklist, and the reporting format. |
| [MOBILE-ENVIRONMENT-SETUP.md](./MOBILE-ENVIRONMENT-SETUP.md) | What the host must provide before a run — the simulator, the emulator, the Appium drivers — and the exact commands a human runs to provide them. The framework itself installs nothing. |

---

## Project-level documents

| Document | What it answers |
|---|---|
| [../README.md](../README.md) | How to install, configure and run the suite. |
| [../CLAUDE.md](../CLAUDE.md) | The rules an AI agent must follow in this repository. |

---

## Where the code lives

| Path | Contents |
|---|---|
| `tests-mobile/` | The mobile-web specs — the test layer |
| `src/mobile/pages/` | Page Objects — one per route |
| `src/mobile/components/` | Reusable shell regions (drawer, top bar, datatable, flash, mobile shell) |
| `src/mobile/services/` | Sign-in, session replay, the app's own internal API |
| `src/mobile/fixtures/` | The composition root — `useAuthenticatedApp` / `useSignedOutApp` |
| `src/mobile/selectors.ts` | Every selector, verified against the live app |
| `src/mobile/models/` | Typed models for the data the app returns |
| `src/shared/` | The only cross-layer import path: environment, tags, titles, policy, the `expect` adapter |
| `config/devices.ts` | The device matrix — which handset, which browser, which viewport |
| `config/test-policy.json` | The feature-gating matrix |
| `wdio.shared.conf.ts` | Everything the iOS and the Android run share |
| `wdio.ios.conf.ts` | Safari on an iPhone 17 Simulator (XCUITest) |
| `wdio.android.conf.ts` | Chrome on a Samsung Galaxy Emulator (UiAutomator2) |
| `.claude/agents/` | Agent definitions |
| `.claude/rules/` | Project rules that apply to every change |
| `.claude/skills/` | Task-specific skills |

---

## Rules that shape every change

The full text lives in `.claude/rules/`; the short version:

1. **Plan before implementing** — `.claude/rules/plan-before-implementation.md`.
   Clarify first, write a plan to `.claude/plans/<date>-<slug>/plan.md`, get
   approval, then implement.
2. **GitHub Flow with typed branches** —
   `.claude/rules/git-flow-branching.md`.
   `feat/`, `fix/`, `test/`, `refactor/`, `chore/`, `docs/`, `hotfix/`.
3. **Mobile-first** — `.claude/rules/appium-mobile-first.md`.
   The target is always a phone-sized browser; no desktop-only affordances.
4. **No hard waits** — `.claude/rules/no-hard-waits.md`.
   Every wait is a state wait; a sleep is a bug.
