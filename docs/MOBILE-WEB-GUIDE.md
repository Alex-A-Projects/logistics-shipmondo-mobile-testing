# Mobile-web testing guide

**Document version:** 2026-11-06
**Audience:** QA Engineers, Test Automation Team
**Purpose:** What "mobile web" means for this suite, how it differs from a
desktop suite, and what a Playwright suite has to change when it is ported to
WebdriverIO.

---

## 1. What this suite is

A **mobile-web** suite runs the **web application** in the **mobile browser**
of a **simulated device**, and asserts on the DOM that browser renders.

```
┌─ device (iPhone 17 Simulator / Samsung Galaxy Emulator) ─────┐
│  ┌─ browser (Safari / Chrome) ─────────────────────────────┐  │
│  │   https://demo.shipmondo.com   ← the app under test    │  │
│  └─────────────────────────────────────────────────────────┘  │
└─────────────────────────▲────────────────────────────────────┘
                          │  WebDriver / W3C protocol
                    ┌─────┴──────┐
                    │   Appium   │  XCUITest  ·  UiAutomator2
                    └────────────┘
```

There is **no native application** in the picture. The session is negotiated
with `browserName` (not `app`), which is what makes Appium launch the
device's own browser instead of an app bundle:

```ts
// wdio.ios.conf.ts
{ platformName: 'iOS', 'appium:automationName': 'XCUITest',
  browserName: 'Safari', … }

// wdio.android.conf.ts
{ platformName: 'Android', 'appium:automationName': 'UiAutomator2',
  browserName: 'Chrome', … }
```

**What that means in practice:**

- The page is a **web page**: CSS selectors, XPath, `browser.execute`,
  `window.innerWidth`, `navigator.userAgent`. Not accessibility ids, not
  `~XCUIElementTypeButton`, not `UiSelector`.
- The browser chrome is **real**: Safari on iOS renders with the WebKit engine
  and the iOS viewport rules; Chrome on Android renders with Blink. A
  difference between the two platforms is a genuine platform difference, not a
  test artefact.
- The device is real hardware *behaviour*: a software keyboard that covers the
  lower half of the screen, touch targets instead of a cursor, an off-canvas
  drawer instead of a fixed sidebar.

---

## 2. The device matrix

[`config/devices.ts`](../config/devices.ts) is the single source of truth for
"which handset does the suite run on". Every field can be overridden from the
environment.

| | iOS | Android |
|---|---|---|
| `platformName` | `iOS` | `Android` |
| `automationName` | `XCUITest` | `UiAutomator2` |
| `browserName` | `Safari` | `Chrome` |
| `deviceName` | iPhone 17 Pro | Samsung Galaxy S25 |
| `platformVersion` | 26.0 | 15 |
| CSS viewport | 402 × 874 | 393 × 852 |
| User-agent fragment | `iPhone` | `Android` |

The viewport is the **CSS pixel** size of the visible area — what a
responsive layout reacts to. It is not the physical pixel count, which is why
the device pixel ratio is asserted separately (a real phone reports more than
1).

The **device** is chosen by the config file, never by an environment variable.
A run therefore can never end up on a device it did not ask for.

---

## 3. What is genuinely different on a phone

The suite exists to catch the things a desktop run never sees. Each of these
has an assertion in `tests-mobile/mobile/mobile-web.spec.ts`:

| Check | What it catches |
|---|---|
| The user agent identifies a mobile device | A desktop browser reached the device |
| The viewport is phone-sized | The **desktop layout** was served on a phone |
| The device pixel ratio is above 1 | A scaled desktop window, not a real screen |
| The shell is in its mobile layout | The responsive breakpoint did not trigger |
| The page reports touch support | The session is not a touch session |
| The navigation is an off-canvas drawer | The drawer state is not detected correctly |
| The viewport can be resized | The shell survives a keyboard / rotation |

### Interaction differences

**The software keyboard covers the submit button.** On a phone, tapping a
password field raises the keyboard over the lower half of the screen, and the
submit button may sit behind it. The login page therefore scrolls the button
into view before tapping it.

**Typing is atomic.** The credentials are typed through `setValue` — one
assignment — rather than key by key, so the on-screen keyboard cannot swallow
a character between two keystrokes.

**There is no hover.** Anything that only appears on hover on a desktop is
unreachable on a phone. The navigation groups are therefore *expanded*, not
*hovered*.

**There is no right-click and no mouse-only drag.** The suite never uses them.

### The navigation is a drawer

On a desktop the sidebar is always visible. On a phone it is an off-canvas
drawer behind a hamburger, and a leaf link is invisible until its group is
expanded. Reaching *Address book* means: open the drawer → expand the owning
group → tap the leaf. That is what
`SidebarComponent.navigateTo()` does, and it is why the navigation-heavy
scenarios are the slowest ones in the suite.

---

## 4. The mobile adaptation of each scenario

The desktop suite this was ported from ran in a desktop browser. Every
scenario was kept; the *interaction* changed. The mapping:

| Desktop scenario | Mobile adaptation |
|---|---|
| Click a sidebar link | Open the drawer, expand the group, tap the leaf |
| Fill the login form and press Enter | `setValue` for both fields, scroll the submit into view, tap it |
| Assert the account name in the header | Open the profile dropdown, read `.company-name` |
| Read the first column of a table | Read the DOM in one `browser.execute` call — a round trip per cell is expensive over a device link |
| Assert the table headers | Same, and remember column 1 is the checkbox column |
| Check the app's own endpoints | Issue the XHR from inside the mobile browser, so the session cookie and the same-origin rules apply |
| Resize the window | Resize the *device* viewport — the keyboard opening and the device rotating both do it |

What did **not** change: what is asserted. A shipment id is numeric on a
phone and on a desktop; the list and the backing endpoint must agree in both.

---

## 5. Porting notes — Playwright → WebdriverIO

This framework was ported from a Playwright suite. Most of the port is
mechanical; a handful of differences are not.

### 5.1 `expect(value, 'message')` — the one that bites

Playwright's `expect` takes a **second** argument and prints it above the
failure:

```ts
expect(name, 'the signed-in account name is not shown anywhere in the header').toBeTruthy();
```

WebdriverIO's `expect` is Jest's, and Jest takes **one** argument. A second
one is not a type error — it is a **runtime** failure:

```
Error: Expect takes at most one argument.
```

So the idiom cannot simply be re-typed. It has to be *provided*.

[`src/shared/expect.ts`](../src/shared/expect.ts) provides it:

```ts
export const expect = new Proxy(baseExpect, {
    apply(target, thisArg, argumentsList) {
        const [actual, message] = argumentsList;
        if (argumentsList.length > 2) {
            return Reflect.apply(target, thisArg, argumentsList);
        }
        const expectation = Reflect.apply(target, thisArg, [actual]);
        return message ? withMessage(expectation, message) : expectation;
    },
});
```

- while the assertion **passes**, `expect(value, 'message')` behaves exactly
  like `expect(value)`;
- when it **fails**, the message is prefixed to the original Jest failure —
  the diff is kept, so the report still shows what was expected and what
  arrived;
- the WebdriverIO matchers (`toBeDisplayed()`, `toBeExisting()`, …) and the
  asymmetric matchers (`expect.anything()`) keep working, because the proxy
  forwards every property to the original `expect`.

Use the `expect` from `src/shared` in every spec. The raw one from
`@wdio/globals` is single-argument only.

### 5.2 `describe` / `it` / `beforeEach` are ambient globals

`@wdio/globals` exports `browser`, `expect`, `$`, `$$` — **not** `describe`,
`it` or `beforeEach`. Those are the **ambient Mocha globals**: Mocha's BDD
interface installs them on `globalThis`, and WebdriverIO's Mocha framework
wraps them so that the runner's `beforeTest` / `afterTest` hooks fire.

They are deliberately **not imported**:

```ts
// Wrong — @wdio/globals does not export these.
import { describe, it, beforeEach } from '@wdio/globals';

// Also wrong — Mocha's ESM exports resolve against a context that only exists
// while a file is being loaded, so a static import throws at module-evaluation
// time.
import { describe, it } from 'mocha';

// Right — use the ambient globals.
import { browser } from '@wdio/globals';
import { describeMobile, itMobile, expect, Tags, featureTag, title } from '../../src/shared';
```

The types come from `@types/mocha`, which is already in the `types` array of
`tsconfig.json`.

### 5.3 `browser.getUrl()` is asynchronous

In WebdriverIO 9 every browser command returns a promise — including
`getUrl()`. A page object therefore exposes an **async method**, not a getter:

```ts
// Wrong — a getter cannot await.
get isCurrentRoute(): boolean {
    return browser.getUrl().includes(this.hash);   // a Promise, always truthy
}

// Right.
async isCurrentRoute(): Promise<boolean> {
    const url = await browser.getUrl();
    return url.includes(this.hash);
}
```

### 5.4 Element lists are chainable

`browser.$$` is typed as a *chainable* array whose `length` is a promise and
whose elements are only reachable through `getElements()`. Reading a count
through `.length` therefore does not type-check, and indexing the chainable
array does not give a plain element.

The suite reads counts through one helper —
`countOf()` in [`src/mobile/components/base.component.ts`](../src/mobile/components/base.component.ts)
— and resolves lists through `getElements()` before indexing them.

### 5.5 The fixtures are hooks, not arguments

Playwright passes fixtures as test arguments. WebdriverIO has no equivalent,
so the fixtures are **functions the spec calls from its own `beforeEach`**:

```ts
let app: AppContainer;

beforeEach(async () => {
    app = await useAuthenticatedApp();
});
```

### 5.6 The session is captured once per worker

The demo app is a slow remote server. Signing in once per test would cost the
whole budget several times over. The suite signs in **once per worker**,
captures the session cookies **in memory**, and replays them into the browser
before each test. The cookies are never written to disk, never exported to an
artefact and never printed.

---

## 6. What still has to be true of a good mobile-web test

1. **It states its mobile adaptation.** If the test would pass identically in a
   desktop browser, it does not belong in this suite.
2. **It waits on state.** Every wait is anchored on something the app
   controls — an element, a class, a URL, a row.
3. **It does not depend on the desktop chrome.** No hover, no right-click, no
   fixed viewport, no assumption that the sidebar is visible.
4. **It reads the DOM, not the screen coordinates.** A phone screen is small;
   an element that is scrolled out of view is still part of the page.
5. **It works on both platforms.** A test that only works on one browser is a
   bug report, not a test.
