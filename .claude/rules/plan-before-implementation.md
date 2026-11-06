# Plan Before Implementation — All Implementation Work

**Before starting ANY implementation work, always gather requirements, create a plan, and get approval.**

## Applies to

- EnterPlanMode tasks (explicit planning mode)
- Regular implementation requests (feature, enhancement, fix, refactor)
- Bug fixes (except obvious trivial fixes)
- Refactoring (single-file or multi-file)
- Architecture changes
- Test automation work
- Infrastructure changes
- Any other code-related work unless the task is a clearly trivial one-line change and the user explicitly allows skipping planning

---

## Phase 1 — Requirements Discovery

Before creating a plan, gather enough information to avoid making assumptions.

Use `AskUserQuestion` repeatedly until requirements are sufficiently understood or the user explicitly instructs you to proceed with assumptions.

Do not rush into planning.

### Functional Requirements

Clarify:

- Expected behavior
- User flows
- Business rules
- Validation rules
- Error handling expectations
- Success criteria
- Acceptance criteria
- Edge cases
- Negative scenarios

Questions should explore:

- What should happen?
- What should not happen?
- How should failures be handled?
- What are the boundary conditions?

### Mobile Adaptation Requirements

Every new or changed test must state, in the plan, **how the flow behaves on a phone**. This is a required section of the plan, not an optional one, because the mobile-web surface breaks desktop assumptions in ways that only surface on a device.

State explicitly:

- **Touch vs mouse** — is the interaction a tap, a long press, a swipe, or a drag? Does the element respond to `click` (a native tap in the mobile browser) or does it need a coordinate-based touch? A hover-only affordance is unreachable on a phone.
- **Viewport** — does the element exist at the mobile breakpoint (iPhone 17: 402×874 CSS pixels; Samsung Galaxy S25: 393×852)? Is the control inside the initial viewport, or does it need scrolling first?
- **Off-canvas navigation** — is the target inside the left drawer (`#left-panel`)? If so, the plan must include opening the drawer and expanding the owning `li[data-menu-collapse]` group(s) outermost-first, because a collapsed leaf cannot be tapped.
- **Software keyboard** — does a text field bring up the on-screen keyboard that covers the lower half of the screen? If a submit button or a validation message can end up behind it, the plan must include scrolling the element into view before the tap, and typing through `setValue` rather than key-by-key.

In addition, every new test must be checked against the feature-gating matrix in `config/test-policy.json`. The plan must name the feature tag the test will carry (for example `featureTag('mobile_navigation')`) and state whether that feature is declared and enabled for the environment the test targets. A feature that is absent from the matrix fails the run loudly; a feature that is present but disabled skips the test. Introducing a test whose feature is not in the matrix is therefore a plan defect to be resolved during planning, not during the run.

### Integration Requirements

Identify all affected systems:

- APIs
- Databases
- Queues
- Authentication systems
- Authorization systems
- Third-party services
- Existing internal services
- UI components
- CI/CD pipelines
- The Appium server and the device session the run depends on

Clarify:

- Compatibility requirements
- Contract changes
- Migration requirements
- Data flow impacts

### Non-Functional Requirements

Clarify:

- Performance expectations
- Security requirements
- Reliability requirements
- Availability requirements
- Scalability expectations
- Logging requirements
- Metrics requirements
- Tracing requirements
- Monitoring requirements
- Compliance requirements

### Technical Constraints

Clarify:

- Existing architecture patterns
- Coding standards
- Approved libraries/frameworks
- Deployment constraints
- Infrastructure constraints
- Repository conventions
- Team-specific practices

The stack of this repository is fixed and must be respected by every plan:

| Concern | The stack of this repository |
| ------- | ---------------------------- |
| Test runner | WebdriverIO v9 (`@wdio/cli`, `@wdio/local-runner`, `@wdio/globals`) |
| Device automation | Appium 2 with the `XCUITest` (iOS) and `UiAutomator2` (Android) drivers |
| Target application | The Shipmondo **web** app in a **mobile browser** — Safari on iOS, Chrome on Android. There is no native app under test |
| Test framework | Mocha, via `@wdio/mocha-framework` |
| Assertions | `expect-webdriverio`, wrapped by `src/shared/expect.ts` |
| Reporting | Allure (`@wdio/allure-reporter`) plus the readable `spec` reporter |
| Language | TypeScript, strict, checked by `npm run typecheck` (`tsc --noEmit`) |
| Structure | `src/shared/` (env, expect, assertions, mocha, policy, tags, titles, paths, generators), `src/mobile/` (selectors, components, pages, services, fixtures, models), `tests-mobile/**/*.spec.ts` |

Two constraints follow directly from that stack and belong in every plan:

- **No Playwright.** Playwright is not a dependency of this repository and must not be introduced, referenced or assumed. Anything a plan needs from a browser-automation API has to be expressed through WebdriverIO and Appium. (The `expect(value, 'message')` call already exists in `src/shared/expect.ts` precisely so that the Playwright-era assertion idiom keeps working without Playwright.)
- **The framework never provisions the environment.** Xcode, the iOS Simulator runtime, Android Studio, the Android system images and the Appium server are assumed to exist on the host. A plan that depends on installing a simulator, an emulator, a system image or a driver is out of scope; a plan that depends on *targeting* an existing one is in scope.

---

## No Assumptions Rule

Never silently assume behavior.

If multiple reasonable interpretations exist:

1. Ask the user.
2. Present available options.
3. Explain trade-offs.
4. Wait for a decision.

Only proceed with assumptions when the user explicitly authorizes it.

Any assumptions that remain must be documented in the plan.

---

## Phase 2 — Solution Planning

After requirements are sufficiently understood:

### Create Plan File

Create a plan in:

`/.claude/plans/<YYYY-MM-DD>-<task-slug>/plan.md`

Examples:

- `/.claude/plans/2026-11-03-add-user-2fa/plan.md`
- `/.claude/plans/2026-11-03-refactor-shipment-page/plan.md`

---

### Plan Contents

The plan must include:

#### Objective

What problem is being solved.

#### Requirements Summary

Summarize discovered requirements.

#### Mobile Adaptation

How the change behaves on the mobile browser: touch vs mouse, viewport, off-canvas navigation, software keyboard. If the change adds a test, also the feature tag it carries and its status in `config/test-policy.json`.

#### Assumptions

List any remaining assumptions.

#### Architecture / Design

Describe:

- High-level approach
- Design decisions
- Architectural impacts

#### Files To Be Modified

List:

- Files to create
- Files to modify
- Files to remove

#### Implementation Steps

Provide a step-by-step implementation plan.

#### Edge Cases

Document:

- Boundary conditions
- Failure scenarios
- Recovery behavior

#### Integration Impact Analysis

Describe:

- Affected services
- APIs
- Databases
- External systems

#### Testability Review

Identify:

- Unit test impact
- Integration test impact
- E2E/UI test impact
- Existing tests requiring updates
- Regression risks

#### Non-Functional Impact

Describe impacts on:

- Performance
- Security
- Reliability
- Scalability
- Observability

#### Alternatives Considered

List alternatives and explain why they were rejected.

#### Risks

Identify implementation risks and mitigation strategies.

---

## Phase 3 — Review

After creating the plan:

1. Open the plan file.
2. Present the plan to the user.
3. Wait for explicit approval.

Valid approvals include:

- "approved"
- "proceed"
- "implement"
- Equivalent explicit confirmation

Do not begin implementation before approval.

---

## Phase 4 — Implementation

Only after explicit approval:

1. Exit planning mode.
2. Implement according to the approved plan.
3. If new requirements are discovered:
   - Stop implementation.
   - Return to clarification.
   - Update the plan.
   - Request approval again if scope changes materially.

---

## Core Principle

Think before implementing.

Clarify before planning.

Plan before implementing.

Never replace missing requirements with assumptions when clarification is possible.
