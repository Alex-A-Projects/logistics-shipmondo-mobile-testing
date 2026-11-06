# The test layer — writing specs

## Table of contents

1. [The shape of a spec](#the-shape-of-a-spec)
2. [`describeMobile` and `itMobile`](#describemobile-and-itmobile)
3. [Tags](#tags)
4. [Ticket titles](#ticket-titles)
5. [The `expect(value, message)` adapter](#the-expectvalue-message-adapter)
6. [Collecting several failures](#collecting-several-failures)
7. [Waiting](#waiting)
8. [Anti-patterns](#anti-patterns)

---

## The shape of a spec

A spec is a test file under `tests-mobile/<area>/<feature>.spec.ts`. It imports four things and nothing else from the framework:

```ts
import { browser } from '@wdio/globals';
import { describeMobile, itMobile, expect, Tags, featureTag, title } from '../../src/shared';
import { collectFailures, expectNoFailures } from '../../src/shared/assertions';
import { useAuthenticatedApp, useSignedOutApp, type AppContainer } from '../../src/mobile/fixtures';
```

The container is declared at the suite level and filled in `beforeEach`:

```ts
describeMobile(
    'Login',
    { features: [featureTag('auth')], tags: [Tags.UI, Tags.SMOKE, Tags.AUTH] },
    () => {
        let app: AppContainer;

        beforeEach(async () => {
            app = await useSignedOutApp();
        });

        itMobile(
            title(3001, 'shows the login form on the login page'),
            { features: [featureTag('auth')], tags: [Tags.SMOKE] },
            async () => {
                const email = await app.pages.login.emailInput();
                const password = await app.pages.login.passwordInput();
                const submit = await app.pages.login.submitButton();

                await expect(email).toBeDisplayed();
                await expect(password).toBeDisplayed();
                await expect(submit).toBeDisplayed();
            },
        );
    },
);
```

Note the import path: a spec lives two levels under the repository root (`tests-mobile/<area>/`), so the shared layer is at `../../src/shared` and the fixtures at `../../src/mobile/fixtures`.

---

## `describeMobile` and `itMobile`

Both live in `src/shared/mocha.ts` and wrap the ambient Mocha globals. They are **not** imported from `@wdio/globals`: WebdriverIO's Mocha framework installs `describe` / `it` / `beforeEach` on `globalThis`, and it is those wrappers that trigger the runner's `beforeTest` / `afterTest` hooks.

```ts
export interface MobileTestOptions {
    features?: readonly string[];
    tags?: readonly string[];
}
```

### The gate happens at definition time

`describeMobile` and `itMobile` both call `resolveFeatureGate()` **while the file is being collected**, before any session exists:

- A feature tag that is **not declared** in `config/test-policy.json` for the current env → the suite **throws during collection**. The run fails loudly, in the first second, before a device is even touched.
- A feature tag that is **declared but disabled** → the test is **skipped** with the reason `Feature "<name>" is disabled in <env>.`
- A feature tag that is **declared and enabled** → the test runs.

This is why a typo in a feature tag is a defect rather than a silent skip. A test that never runs must never look like a test that passed.

### The tags live in the title

WebdriverIO has no native tag support, so the selection tags are appended to the Mocha title in a stable, sorted order. That is what makes `--mochaOpts.grep "@smoke"` work:

```bash
npm run test:ios -- --mochaOpts.grep "@smoke"
npm run test:ios -- --mochaOpts.grep "@feature:auth"
```

---

## Tags

Two independent axes, both from `src/shared/tags.ts`.

### Selection tags — `Tags`

```ts
Tags.SMOKE, Tags.SANITY, Tags.REGRESSION, Tags.NEGATIVE, Tags.BOUNDARY,
Tags.E2E, Tags.SECURITY, Tags.ACCESSIBILITY, Tags.CRITICAL,
Tags.MOBILE, Tags.UI, Tags.SHIPMENT, Tags.ORDER, Tags.ADDRESS,
Tags.AUTH, Tags.RESPONSIVE
```

Every mobile-web test carries `Tags.MOBILE`. A test that asserts something about the layout or the viewport also carries `Tags.RESPONSIVE`.

### Feature tags — `featureTag()`

```ts
featureTag('auth')          // → '@feature:auth'
```

The name must exist in `config/test-policy.json` for the current env. The declared features are:

`auth`, `dashboard`, `shipments_list`, `shipments_drafts`, `orders`, `address_book`, `api_access`, `account_settings`, `mobile_web`, `mobile_navigation`.

---

## Ticket titles

Every test title is prefixed with a ticket so a failure maps back to a ticket without a lookup:

```ts
import { title } from '../../src/shared';

title(3602, 'reports a mobile-sized viewport');
// → 'SHIP-3602 | reports a mobile-sized viewport'
```

The prefix comes from `TICKET_PREFIX` in `src/shared/env.ts` (default `SHIP`, overridable with the `TICKET_PREFIX` environment variable). The description states **what is verified**, not what is clicked — "renders the mobile layout of the app shell", not "opens the app".

The numbering is already spoken for in this repository: `3001–3007` auth, `3101–3106` dashboard, `3201–3205` shipments, `3301–3306` orders, `3401–3404` address book, `3501–3503` API access, `3601–3610` the mobile-web layer itself. Pick the next free number in the band that matches the area.

---

## The `expect(value, message)` adapter

`src/shared/expect.ts` exports the suite's `expect`. It behaves exactly like WebdriverIO's `expect` while the assertion passes, and it prefixes the failure with the diagnostic message when it does not.

```ts
import { expect } from '../../src/shared';

const name = await signedIn.components.topbar.accountName();

expect(name, 'the signed-in account name is not shown anywhere in the header').toBeTruthy();
```

The second argument is optional, and the matcher surface is unchanged — the WebdriverIO matchers (`toBeDisplayed()`, `toBeExisting()`, `toHaveText()`, `toHaveLength()`) and the asymmetric matchers (`expect.anything()`) all work.

The reason the adapter exists is worth stating plainly: WebdriverIO's `expect` is Jest's, which takes exactly one argument and throws `Expect takes at most one argument.` for a second. Dropping the messages would work, but on a phone they are the difference between *"expected 'undefined' to be truthy"* and *"the signed-in account name is not shown anywhere in the header"*.

For an element, the assertion is awaited:

```ts
const content = await app.pages.dashboard.content();
await expect(content).toBeDisplayed();
```

For a value, it is not:

```ts
expect(await browser.getUrl()).toMatch(/#\/dashboard/);
```

---

## Collecting several failures

A case that checks several independent things should report **all** of them, not just the first. `src/shared/assertions.ts` provides the pattern:

```ts
import { collectFailures, expectNoFailures } from '../../src/shared/assertions';

const failed = await collectFailures({
    'the drawer is reachable': async () =>
        expect(await app.components.sidebar.isDrawerOpen()).toBe(true),
    'the core sections are in the navigation': async () => {
        const hrefs = await app.components.sidebar.hrefs();
        expect(hrefs.some((href) => href.includes('#/orders'))).toBe(true);
    },
});

expectNoFailures(failed, 'Navigation checks failed');
```

`collectFailures()` runs every check, swallows the individual failures and returns their names. `expectNoFailures()` asserts the list is empty, with the names in the failure message — so the report says *which* checks failed.

Use it whenever the checks are genuinely independent. Do not use it to paper over a broken precondition: if the drawer could not be opened, that is a failure of the act, not something to collect.

---

## Waiting

There are three waits in this suite and no others.

**A state wait on an element** — the element must become visible:

```ts
const error = await app.pages.login.errorMessage();
await error.waitForDisplayed({
    timeout: 30_000,
    timeoutMsg: 'The login form did not report the rejected password.',
});
```

**A condition wait on the browser state** — a URL, a drawer, a route:

```ts
await browser.waitUntil(async () => (await browser.getUrl()).includes('#/orders'), {
    timeout: 30_000,
    timeoutMsg: 'The orders route did not open from the drawer.',
    interval: 500,
});
```

**A route-aware readiness wait** — the page's own ready signal, already wired into `gotoAndWait()`:

```ts
await app.pages.shipments.gotoAndWait();
```

Never `setTimeout`, never `browser.pause()`, never a sleep dressed up as a wait. The `waitforTimeout` in the shared WebdriverIO config (20 seconds by default) is the budget for a *single* WebDriver command, not a substitute for a condition.

---

## Credentials in a spec

Credentials come from `process.env` and are read through the shared environment module. A spec may read `process.env.SHIPMONDO_WEB_USER` directly — that is what the existing specs do — but the value must never be printed, never asserted on, and never attached to a report.

```ts
const email = process.env.SHIPMONDO_WEB_USER ?? '';
const password = process.env.SHIPMONDO_WEB_PASSWORD ?? '';

await app.pages.login.login(email, password);
```

---

## Anti-patterns

- An `expect` outside a spec file.
- A selector literal in a spec file — `browser.$('#content')` belongs in the POM layer.
- A title without a ticket prefix, or a title that describes the click rather than the verification.
- A feature tag that is not in `config/test-policy.json`.
- A `waitUntil` without a `timeoutMsg` — the default message does not say what was being waited for.
- A test that depends on a previous test having run.
- A test that asserts on live tenant data (a specific shipment id, a row count) as a fixed value.
- A screenshot written by hand into `allure-results/` — the shared config's `afterTest` hook already does it.
