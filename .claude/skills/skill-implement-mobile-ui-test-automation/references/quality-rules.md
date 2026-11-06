# Quality rules — the review checklist

## The checklist

Run through this list before any change is committed. Every item is binary: either the code follows it or it does not.

### 1. No hard waits

Every wait is a state wait. A sleep is a flake waiting to happen, and on a remote tenant over a device link it is a flake that will happen.

```ts
// Wrong
await browser.pause(2000);
await new Promise((resolve) => setTimeout(resolve, 2000));

// Right — the element must become visible
await element.waitForDisplayed({
    timeout: 30_000,
    timeoutMsg: 'The login form did not report the rejected password.',
});

// Right — a condition on the browser state
await browser.waitUntil(async () => (await browser.getUrl()).includes('#/orders'), {
    timeout: 30_000,
    timeoutMsg: 'The orders route did not open from the drawer.',
    interval: 500,
});
```

Every `waitUntil` carries a `timeoutMsg` that says what was being waited for.

### 2. No assertions in the POM, component or service layers

```ts
// Wrong — in src/mobile/pages/, components/ or services/
expect(await this.errorMessage.isExisting()).toBe(true);

// Right — in tests-mobile/**/*.spec.ts
const error = await app.pages.login.errorMessage();
await expect(error).toBeDisplayed();
```

The reason is not dogma: an assertion inside a page object produces a failure message about a locator, not about the behaviour the user cares about. The assertion belongs next to the expectation.

### 3. The feature tag is declared

Every `describeMobile` and `itMobile` carries a `featureTag()` whose name exists in `config/test-policy.json` for the current env.

```ts
// Wrong — 'shipment_list' is not in the matrix
{ features: [featureTag('shipment_list')] }

// Right
{ features: [featureTag('shipments_list')] }
```

An undeclared feature **fails the run loudly at collection time**. That is the designed behaviour: a typo must never quietly disable a test.

### 4. The title is ticket-prefixed

```ts
// Wrong
itMobile('opens the orders list', { ... }, async () => { ... });

// Right
itMobile(title(3301, 'loads the orders route'), { ... }, async () => { ... });
// → 'SHIP-3301 | loads the orders route'
```

The description states what is **verified**, not what is clicked.

### 5. Credentials come from `process.env` only

```ts
// Wrong
const password = 'Shipmondo-Demo-2026';

// Right
const password = process.env.SHIPMONDO_WEB_PASSWORD ?? '';
```

Nothing in the repository hardcodes a credential, and nothing logs one. `src/shared/env.ts` is the only module that reads `process.env` — a spec that needs the address or the password reads it there or from `process.env` directly, but never from a literal.

### 6. No secrets in any artefact

- No credential in a screenshot. The suite's screenshots are of the app; the app never shows the password.
- No session cookie written to `allure-results/`, to a log, or to a report attachment. The worker session lives in memory only.
- No API key attached. The API-access endpoint returns metadata only, and the settings page never renders the key.
- No `.env` committed. It is gitignored; `.env.example` carries placeholders, never real values.

### 7. Mobile-first interactions

- **Tap, never hover.** There is no hover on a touch screen. Any hover-revealed value is verified through the DOM or through the app's own JSON API.
- **Navigate through the drawer.** The left navigation is an off-canvas drawer; a spec that assumes a permanent sidebar is a desktop test in disguise.
- **Expand the owning group.** The navigation groups are accordions and the leaves are invisible until their group is expanded, outermost first.
- **Type atomically.** `setValue` assigns in one go, so the on-screen keyboard cannot swallow a character.
- **Scroll the control into view before tapping it.** The software keyboard covers the lower half of the screen.
- **Reach the account menu through the avatar.** On a phone the account name is in the profile dropdown, not in the header.

### 8. The Allure-friendly failure message

Every assertion carries a message that says what was expected, so the report reads as a sentence and not as a diff.

```ts
expect(
    viewport.width,
    `the viewport is ${viewport.width}px wide — the desktop layout was served`,
).toBeLessThan(768);

expect(
    name,
    'the signed-in account name is not shown anywhere in the header',
).toBeTruthy();
```

The `expect(value, message)` adapter from `src/shared/expect.ts` makes this possible: WebdriverIO's own `expect` accepts exactly one argument.

### 9. Type safety

`tsconfig.json` runs `strict`, `noUnusedLocals`, `noUnusedParameters`, `noImplicitOverride`, `noImplicitReturns` and `noFallthroughCasesInSwitch`.

- No `any`.
- No unused import, no unused local — `noUnusedLocals` turns both into compile errors.
- Every function that can return has an explicit return type on every path — `noImplicitReturns`.
- `npm run typecheck` must pass with no output.

### 10. Test independence

- No test depends on a previous test having run.
- The worker session replay is the only shared state, and it is re-established by the fixture at the start of every test.
- No global mutable state in a spec file.

### 11. No `it.only` in committed code

```ts
// Wrong — it.only('this one test', ...)
```

A focused test silently removes every other case from the run.

---

## The anti-pattern table

| Anti-pattern | Why it is wrong | What to do instead |
|---|---|---|
| `browser.pause(2000)` | A flake that waits to happen | A `waitUntil` on the actual condition |
| `expect()` inside a page object | The failure message names a locator, not a behaviour | Move the assertion into the spec |
| A selector literal in a spec | The DOM knowledge leaks into the test layer | Add it to `src/mobile/selectors.ts` |
| A CSS `:has()` selector | Appium's selector engines do not implement it consistently | Use the route-scoped XPath helpers |
| `#content` as a ready selector | It matches the *previous* route's content | `routeContent(route)` / `routeTableXPath(route)` |
| A feature tag that is not in the matrix | The case never runs and nobody notices | Add the feature to `config/test-policy.json` first |
| A title without a ticket number | A failure cannot be traced back | `title(3301, '…')` |
| `process.env` read outside `src/shared/env.ts` | The resolution rules drift apart | Import from the shared module |
| A hardcoded credential or base URL | A secret in the repository | `process.env` through `src/shared/env.ts` |
| A request made from outside the browser | The same-origin check and the session cookie are lost | `browser.executeAsync` in `AppDataService` |
| Global mutable state between tests | Order dependence | The fixture re-establishes the state per test |
| `it.only` | Silently removes every other case | Run the focused case locally with `--spec` |

---

## Layer-boundary quick check

| File | May import | May not |
|---|---|---|
| `tests-mobile/**/*.spec.ts` | `src/shared/*`, `src/mobile/fixtures`, `@wdio/globals` | `src/mobile/pages/*` directly, `src/mobile/selectors`, `@wdio/globals`' `expect` |
| `src/mobile/fixtures/*` | pages, components, services, `src/shared/*` | a spec file |
| `src/mobile/pages/*` | `src/mobile/components/*`, `src/mobile/selectors`, `@wdio/globals` | a spec file, `src/shared/assertions` |
| `src/mobile/components/*` | `src/mobile/selectors`, `@wdio/globals` | a spec file, a page file |
| `src/mobile/services/*` | `src/mobile/models/*`, `@wdio/globals`, `src/shared/*` | a spec file |
| `src/mobile/selectors.ts` | nothing | everything |

---

## Before you commit

```bash
npm run typecheck
```

Then run the affected spec on at least one device:

```bash
npm run test:ios -- --spec tests-mobile/auth/login.spec.ts
```

And confirm the report renders the failure — or the pass — with the expected labels and the screenshot attached.
