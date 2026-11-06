# No Hard Waits Rule

**Version:** 1.0
**Last Updated:** November 2026

---

# Rule

**There are no fixed sleeps anywhere in this repository.**

Every wait is **condition-based**: it names the condition it is waiting for, gives it an explicit budget, and fails with a message that describes what did not happen.

The following are banned, in specs, in page objects, in components, in services and in fixtures:

- `browser.pause(...)` / `browser.pause`
- `await new Promise((resolve) => setTimeout(resolve, ...))`
- any `sleep(...)` helper, however it is spelled
- any other fixed delay, including a delay smuggled in as a `setTimeout` inside `browser.execute`

A delay is not a wait. A wait is a predicate.

---

# 1. The Permitted Wait Primitives

| Primitive | Use it for | Mandatory arguments |
| --------- | ---------- | ------------------- |
| `waitForDisplayed(...)` | an element must be rendered and visible | `timeout` and `timeoutMsg` |
| `waitForExist(...)` | an element must be present in the DOM | `timeout` and `timeoutMsg` |
| `browser.waitUntil(...)` | any condition that is not a single element state | `timeout`, `interval` and `timeoutMsg` |
| `waitUntil(...)` from `src/mobile/components/base.component.ts` | the same, with the suite's defaults already applied | the condition and, where the default is not right, a `description` |

`waitUntil(...)` from `src/mobile/components/base.component.ts` is the preferred form inside components and page objects: it already supplies the default timeout, the polling interval and a generated `timeoutMsg`, so the only thing a caller has to supply is the condition and what it means.

```typescript
import { waitUntil } from '../../mobile/components/base.component';

// Polls until the drawer is actually reachable on screen.
await waitUntil(
    async () => this.isDrawerOpen(),
    timeouts.waitForDisplayed,
    'the navigation drawer to open',
);
```

When the caller needs a different budget, pass one explicitly and always pass a description:

```typescript
await browser.waitUntil(
    async () => (await browser.getUrl()).includes('#/orders'),
    {
        timeout: 15_000,
        interval: 250,
        timeoutMsg: 'The orders route never appeared in the URL.',
    },
);
```

---

# 2. The Timeout Budget

All budgets come from `src/shared/env.ts`, never from a literal inside a test:

| Constant | Default | Governs |
| -------- | ------- | ------- |
| `timeouts.waitForDisplayed` | 20 000 ms | `waitForDisplayed` / `waitForExist` budgets, and the default of `waitUntil(...)` |
| `timeouts.pageLoad` | 60 000 ms | page and navigation budgets |
| `timeouts.script` | 20 000 ms | `browser.execute` budgets |

Each is overridable through the environment (`WAIT_FOR_DISPLAYED`, `WAIT_FOR_PAGE_LOAD`, `WAIT_FOR_SCRIPT`) so that a slow CI worker can be given more room without a code change. A timeout written as a bare literal in a spec bypasses that mechanism and is therefore a defect.

The same numbers apply in the runner: `wdio.shared.conf.ts` sets `waitforTimeout: timeouts.waitForDisplayed` and a Mocha timeout of 120 000 ms per test.

---

# 3. Why

On a remote simulator every sleep is dead time:

- **It is paid for, always.** A `pause(2000)` costs two seconds on every run, on every retry, and on every developer machine — whether the app was ready in 40 ms or not. On a device session, where each WebDriver round trip is itself slow, that is a substantial share of the suite's wall-clock time.
- **It hides the real race.** A sleep cannot fail. It cannot tell you *what* was missing, so a test that waited two seconds and then asserted is indistinguishable from a test that waited two seconds and asserted the wrong thing. The timeout message is the diagnostic, and a sleep deletes it.
- **It is wrong in both directions.** Too short and the test fails on a slow device; too long and the suite is slow for everyone. A condition-based wait finishes as soon as the condition holds, and fails exactly when it can no longer hold — the two behaviours a sleep cannot have.
- **It is not reproducible.** A race that a sleep happened to absorb today is a race. It reappears on a slower runner, on a different device, or under CI load, and it will be attributed to the application rather than to the test.

---

# 4. Good and Bad

**Good — waiting for a condition, with a diagnostic message:**

```typescript
const error = await login.errorMessage();

await error.waitForDisplayed({
    timeout: timeouts.waitForDisplayed,
    timeoutMsg:
        'No .alert-danger appeared after the sign-in was rejected. ' +
        'The form may not have been submitted, or the server accepted the password.',
});

expect(await login.errorText(), 'the rejection notice is missing').toBeTruthy();
```

**Good — waiting for application state through a component:**

```typescript
await sidebar.openDrawer();

await waitUntil(
    async () => (await browser.getUrl()).includes('#/addresses'),
    timeouts.waitForDisplayed,
    'the address-book route',
);
```

**Good — waiting for a route to be ready (page objects own this):**

```typescript
// BasePage.waitForReady() — a route-specific selector, an explicit budget
// and a message that names the selector that never appeared.
await element.waitForDisplayed({
    timeout: timeouts.waitForDisplayed,
    timeoutMsg: `The page did not become ready (${this.readySelector} never appeared).`,
});
```

**Bad — a fixed sleep:**

```typescript
// FORBIDDEN — dead time, no diagnostic, hides the race.
await browser.pause(3000);
await button.click();
```

**Bad — a promise-based sleep:**

```typescript
// FORBIDDEN — the same dead time, dressed up.
await new Promise((resolve) => setTimeout(resolve, 2000));
```

**Bad — a sleep helper:**

```typescript
// FORBIDDEN — a named sleep is still a sleep.
await sleep(1500);
```

**Bad — a sleep hidden in a script:**

```typescript
// FORBIDDEN — the delay is still fixed, and it is now invisible to review.
await browser.execute(() => new Promise((resolve) => setTimeout(resolve, 1000)));
```

---

# 5. What To Do Instead

When a wait feels necessary, the question is not "how long?" but "until what?". Resolve the question as follows:

| The situation | The condition-based wait |
| ------------- | ------------------------- |
| The element has not rendered yet | `waitForDisplayed` with `timeouts.waitForDisplayed` and a `timeoutMsg` |
| The element must exist but need not be visible | `waitForExist` with the same budget and a message |
| The URL or route must change | `browser.waitUntil` on `browser.getUrl()` |
| A class or attribute must change | `browser.waitUntil` on the element's state, polled via `browser.execute` |
| A component's root must be ready | `waitForDisplayed()` / `waitForExist()` from `BaseComponent` |
| Any other app-controlled condition | `waitUntil(...)` from `src/mobile/components/base.component.ts` |

If no app-controlled condition can be named, the test is missing a readiness signal — not missing a duration. The signal belongs in the page object (`readySelector`) or in the component.

---

# Rationale

For the Shipmondo mobile-web suite:

- **Readable failures** — a timeout message naming the missing condition turns "the test timed out" into "the navigation drawer never opened after tapping the toggle". On a device, where every failure is expensive to reproduce, that difference is the whole value of the failure.
- **Speed on the fast path** — a condition-based wait returns the moment it holds; a sleep always pays its full price.
- **Determinism across platforms** — iOS and Android reach the same state at different speeds. A condition works for both; a duration only works for the slower one, on every platform, forever.
- **A single source of truth** — the budgets live in `src/shared/env.ts` and can be raised for a slow CI worker without touching a single spec.

---

**Summary:** No fixed sleeps, anywhere. Every wait states the condition it is waiting for, carries an explicit timeout and interval, and fails with a message that names what was missing. Dead time is not a wait, and a wait that cannot fail is not a wait at all.
