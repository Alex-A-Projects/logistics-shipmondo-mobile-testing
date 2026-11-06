# The fixture layer — sessions and the container

## Table of contents

1. [Why the fixtures are functions](#why-the-fixtures-are-functions)
2. [`useAuthenticatedApp`](#useauthenticatedapp)
3. [`useSignedOutApp`](#usesignedoutapp)
4. [The worker session replay](#the-worker-session-replay)
5. [`browser.app`](#browserapp)
6. [Writing a spec against the fixtures](#writing-a-spec-against-the-fixtures)
7. [Anti-patterns](#anti-patterns)

---

## Why the fixtures are functions

WebdriverIO has no fixture-injection arguments. There is no `extend()` on the test object, no injected `page` and no teardown callback. The fixtures in this repository are therefore **async functions** that a spec calls from its own `beforeEach` and keeps the returned container.

```ts
// src/mobile/fixtures/index.ts
export async function useAuthenticatedApp(): Promise<AppContainer>
export async function useSignedOutApp(): Promise<AppContainer>
```

Both are exported from `src/mobile/fixtures/index.ts`, which also re-exports `createAppContainer` and the container types.

---

## `useAuthenticatedApp`

Signs in — once per worker — and opens the dashboard.

```ts
export async function useAuthenticatedApp(): Promise<AppContainer> {
    if (!sessionEmail || !sessionPassword) {
        throw new Error(MISSING_CREDENTIALS);
    }

    const container = createAppContainer();
    const auth = new AuthService();

    if (workerSession && workerSession.length > 0) {
        await auth.restoreSession(workerSession);
        await browser.url(`${env.appPath}/#/dashboard`);
        await browser.waitUntil(
            async () => !(await browser.getUrl()).includes('/account/login'),
            {
                timeout: timeouts.pageLoad,
                timeoutMsg: 'The restored session was rejected — the app is not signed in.',
                interval: 500,
            },
        );
    } else {
        await auth.signIn(sessionEmail, sessionPassword);
        workerSession = await auth.captureSession();
    }

    await waitForAppShell(container);
    browser.app = container;
    return container;
}
```

Three things happen, in this order:

1. **The session is established.** Either the worker's captured session is replayed, or a fresh sign-in is performed and the result captured.
2. **The shell is waited for.** `waitForAppShell()` waits for the dashboard's own content region and for the counter tiles to render. It does not wait on the URL: the URL flips to `#/dashboard` *before* the AngularJS shell paints, so a URL wait would hand the test an empty page.
3. **The container is published** on `browser.app` and returned.

### Why the credentials are read from `process.env` here

`sessionEmail` and `sessionPassword` are module-level constants read from `process.env.SHIPMONDO_WEB_USER` and `process.env.SHIPMONDO_WEB_PASSWORD`. When they are missing, the fixture throws `MISSING_CREDENTIALS` immediately, with a message that names the two variables to set. The suite refuses to run against an unauthenticated tenant rather than failing every case with a confusing message.

---

## `useSignedOutApp`

The mirror image. The login specs need the *absence* of a session, so this variant clears the cookies and lands on the login page.

```ts
export async function useSignedOutApp(): Promise<AppContainer> {
    const container = createAppContainer();
    const auth = new AuthService();

    await auth.clearSession();
    await container.pages.login.goto();
    await container.pages.login.waitForReady();

    browser.app = container;
    return container;
}
```

Note that it clears the session rather than merely not signing in: the worker session captured by an earlier `useAuthenticatedApp()` call would otherwise still be in the cookie jar.

---

## The worker session replay

Signing in against the demo tenant is expensive: a real form submission, seconds of remote server time, and then the AngularJS shell rendering over a mobile link. Signing in once per *test* would mean a sign-in per test on every device.

Instead the session is captured **once per worker** and replayed afterwards:

```ts
/** The cookies of the worker session, captured once and replayed per test. */
let workerSession: Cookie[] | undefined;
```

The mechanism is `AuthService`:

```ts
async captureSession(): Promise<Cookie[]> {
    const cookies = await browser.getCookies();
    return cookies;
}

async restoreSession(cookies: Cookie[]): Promise<void> {
    if (cookies.length === 0) {
        return;
    }
    await browser.setCookies(cookies);
}
```

Four rules follow from this shape:

- **The cookies stay in memory.** They are never written to disk, never exported to an artefact, never printed. The module-level variable is the whole storage.
- **The replay is verified, not assumed.** After `restoreSession()`, the fixture navigates to the dashboard and waits until the URL is *not* the login route. If the replay was rejected, the app redirects to `/account/login` and the wait fails with a clear message.
- **The suite runs one device at a time** (`maxInstances: 1`), so a single worker-level session is enough — there is no second worker competing for the same simulator.
- **Each test still gets a fresh container.** The container holds no state, so a test can never see a page object built for a different session.

---

## `browser.app`

The fixture publishes the container on the browser object:

```ts
declare global {
    namespace WebdriverIO {
        interface Browser {
            /** The application container of the running test. */
            app: AppContainer;
        }
    }
}
```

`browser.app` exists so that a helper with no access to the spec's local variable can still reach the pages — for example a page object that needs to consult the datatable component of another route, or an ad-hoc debug script. The spec's own `app` variable remains the normal way in.

---

## Writing a spec against the fixtures

```ts
import { browser } from '@wdio/globals';
import { describeMobile, itMobile, expect, Tags, featureTag, title } from '../../src/shared';
import { useAuthenticatedApp, type AppContainer } from '../../src/mobile/fixtures';

describeMobile(
    'Booked shipments',
    {
        features: [featureTag('shipments_list')],
        tags: [Tags.UI, Tags.REGRESSION, Tags.SHIPMENT, Tags.MOBILE],
    },
    () => {
        let app: AppContainer;

        beforeEach(async () => {
            app = await useAuthenticatedApp();
        });

        itMobile(
            title(3201, 'loads the booked shipments route'),
            { features: [featureTag('shipments_list')], tags: [Tags.REGRESSION] },
            async () => {
                await app.pages.shipments.gotoAndWait();

                expect(await browser.getUrl()).toMatch(/#\/shipping-labels/);
            },
        );
    },
);
```

Two conventions worth keeping:

- **The suite-level `describeMobile` declares the feature and the area tags; each `itMobile` declares the feature and its own selection tags.** The feature tag repeats on the case on purpose: the gate runs per case, so a case can be skipped independently of its suite.
- **A case that needs a signed-out state calls `useSignedOutApp()` inside the case**, not in `beforeEach`, when only that one case needs it. The existing login spec does exactly this for the signed-in header check.

---

## Anti-patterns

- Signing in once per test against the remote tenant — sign in once per worker.
- Writing the session cookies to disk, or to `allure-results/`.
- Waiting on the URL to conclude that the app has loaded — wait for the shell.
- A route-agnostic wait selector, which matches the previous route's DOM.
- A fixture that asserts. Fixtures provide; specs assert.
- Global mutable state in a spec file that outlives the test.
- A fixture that reaches into another fixture's internals — the container is the only interface.
