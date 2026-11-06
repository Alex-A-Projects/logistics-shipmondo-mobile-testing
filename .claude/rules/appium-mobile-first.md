# Appium Mobile-First Rule

**Version:** 1.0
**Last Updated:** November 2026

---

# Rule

**Every implementation decision in this repository is mobile-first.**

This repository tests the Shipmondo **web** application running inside a **mobile browser** on a simulator or an emulator — Safari on an iPhone 17 (XCUITest) and Chrome on a Samsung Galaxy S25 (UiAutomator2). There is no desktop browser in scope, and no native app under test. A decision that would be reasonable on a desktop browser but wrong on a phone is not a simplification to be made later; it is a defect to be caught now.

Concretely, the following are binding on every change to this repository.

---

# 1. The Target Is the Mobile Browser

The subject under test is `https://demo.shipmondo.com` (or the environment selected by `TEST_ENV`) as rendered by a phone-sized browser. The desktop rendering of the same URL is out of scope.

Consequences:

- Selectors are chosen for the **mobile DOM**, not the desktop DOM. The app is a responsive admin theme: the left navigation is an off-canvas drawer, and the list pages render their table twice (a header-only clone plus the scrolling body table). The body table is the one that holds data.
- Layout assertions use the mobile viewport — 402×874 CSS pixels on the iPhone 17 profile, 393×852 on the Samsung Galaxy S25 profile (`config/devices.ts`).
- A change that only makes sense above the mobile breakpoint does not belong in this repository.

---

# 2. Interactions Must Be Touch-Realistic

The user's finger, not a cursor, is the input device. Every interaction in a page object or a spec must be expressible as something a thumb can do.

- **Tap targets.** Elements are tapped, not "clicked at a coordinate". The element is located, waited for, and then activated.
- **One atomic assignment for text input.** Passwords and e-mail addresses are entered with `setValue`, not by sending key events one at a time. Key-by-key typing on a mobile browser fights the on-screen keyboard, which swallows characters and produces flaky, unreproducible failures.
- **Scroll before you tap.** The software keyboard covers the lower half of the screen. A submit button that sits behind it must be scrolled into view (`scrollIntoView({ block: 'center' })`) before it is tapped, otherwise the tap lands on the keyboard and the test fails for a reason that has nothing to do with the application.
- **Accordion groups open outermost-first.** A collapsed navigation group hides its leaves with `display: none`; a leaf several groups deep is not tappable until every ancestor group is expanded.

---

# 3. Never Introduce a Desktop-Only Assumption

The following patterns are banned, because none of them can occur on a phone:

| Desktop-only pattern | Why it fails on a phone | Mobile-correct alternative |
| -------------------- | ---------------------- | ------------------------- |
| Hover menus and hover-revealed actions | There is no pointer to hover with; the element never appears | Open the control by tapping it, or assert the element is not reachable in the mobile layout |
| Right-click / context menu | No secondary pointer button exists | Use the application's own explicit action affordance |
| Mouse-only drag and drop | No mouse, and touch drag has a different event model | Use the app's own reorder/tap-to-move control, or do not test the interaction here |
| Fixed desktop viewport assumptions | The viewport is a phone, and the browser chrome reduces it further | Read the viewport at runtime (`window.innerWidth` / `window.innerHeight`) or use the device profile's viewport |

The same rule applies to any assumption that a pointer is a mouse: `isDisplayed()` returning `true` for an off-canvas element is a trap, because a translated-off-screen drawer still has a box. Visibility of a mobile drawer is decided from its **viewport rectangle**, not from the element's display state.

---

# 4. There Is No `app` Capability

The mobile-web session has **no `app` capability**. The application under test is a web page reached by URL, so there is nothing to install and nothing to launch.

What selects the browser is the **`browserName` capability**, and it is the only thing that does:

| Platform | `automationName` | `browserName` | Device |
| -------- | ---------------- | ------------- | ------ |
| iOS | `XCUITest` | `Safari` | iPhone 17 Pro (`iPhone 17` family) |
| Android | `UiAutomator2` | `Chrome` | Samsung Galaxy S25 |

The two profiles live in `config/devices.ts` (`IOS_DEVICE`, `ANDROID_DEVICE`) and are referenced by `wdio.ios.conf.ts` and `wdio.android.conf.ts`. A session is mobile-web because `browserName` is set — not because an `app` bundle was supplied, and not because a device was chosen.

Consequently:

- Never add `app`, `appPackage`, `appActivity`, `bundleId` or `appium:app` to a capability.
- Never "relaunch the app" — the browser is navigated with `browser.url(...)`.
- The platform config files are the single place where a browser is chosen; a spec must never branch on platform to reach a different URL or a different flow.

---

# 5. State Is Read From the DOM, Through the Mobile Browser

All application state is observed through the DOM of the page rendered in the mobile browser. The suite never reaches for a desktop-specific API, a native bridge, a local test server, or a direct database read to decide what the application believes.

- Prefer a component method or a page object over a raw `browser.execute` in a spec; the components already encapsulate the mobile-aware reads.
- When a script is needed, it is still *browser* script: `window.innerWidth`, `document.querySelector`, `getBoundingClientRect()` — all executed in the page the mobile browser is showing.
- A component exposes state and performs actions; it never asserts. Verification belongs in the spec, where the failure message can name what was expected.

---

# 6. The Framework Never Installs the Environment

**The Appium server, the iOS Simulator, the Android emulator and the device images are never installed or configured by this repository.**

The framework only *targets* environments that already exist:

- Xcode, the iOS Simulator runtime, the `xcuitest` Appium driver and the booted simulator are assumed to be present on the host.
- Android Studio, the Android system images, the `uiautomator2` Appium driver and the running emulator are assumed to be present on the host.
- An Appium server is either already running at `APPIUM_HOST:APPIUM_PORT` (`WDIO_APPIUM_SERVICE=false`) or started by the `@wdio/appium-service` against an installation that already exists. The service starts a server; it does not install one.

What this means in practice:

- No npm script, npm hook, CI step or documentation in this repository may install a simulator, an emulator, a system image, a driver or the Appium server itself.
- The device profile in `config/devices.ts` is a **description** of a device, not a download of one.
- Environment problems (no booted simulator, missing driver, no Appium on the port) are reported as environment problems. They are never worked around by installing software from inside a test run.

---

# Rationale

For the Shipmondo mobile-web suite:

- **Fidelity** — a defect that only appears at the mobile breakpoint, behind the drawer, or under the software keyboard is exactly the defect this suite exists to find. A desktop-shaped test proves nothing about it.
- **Reproducibility** — touch-realistic interactions produce the same gestures on both platforms. Desktop shortcuts produce platform-specific flakes that look like application bugs.
- **Honest failure messages** — a timeout on a device is expensive (seconds per round trip). A wait that names the condition it is waiting for tells the reader what actually failed; a sleep tells them nothing.
- **Portability** — because the framework assumes the environment rather than building it, the same suite runs unchanged on a developer laptop and on a CI worker that already provides the device.
- **No hidden infrastructure** — a repository that never installs the Appium server, the simulator or the emulator keeps its dependency surface auditable: the only things it installs are npm packages, pinned in `package.json`.

---

# Example: Correct Approach

**Opening the navigation drawer and reaching a nested leaf:**

```typescript
// The sidebar is an off-canvas drawer on a phone: open it, expand the
// owning group outermost-first, then tap the leaf. The drawer state is
// confirmed through its viewport rectangle, never through a sleep.
const sidebar = new SidebarComponent();

await sidebar.navigateTo('Address book');

await waitUntil(
    async () => (await browser.getUrl()).includes('#/addresses'),
    timeouts.waitForDisplayed,
    'the address-book route in the URL',
);
```

**Typing credentials and submitting under the software keyboard:**

```typescript
const login = new LoginPage();

// setValue is a single atomic assignment — key-by-key typing fights the
// on-screen keyboard and loses characters.
await (await login.emailInput()).setValue(email);
await (await login.passwordInput()).setValue(password);

// submit() scrolls the button to the centre of the viewport first, so the
// tap does not land on the keyboard.
await login.submit();
```

**Asserting the mobile viewport from the page itself:**

```typescript
const shell = new MobileShellComponent();
const viewport = await shell.viewport();

expect(
    viewport.width,
    'the browser is not rendering the mobile breakpoint',
).toBeLessThan(768);
```

---

# Example: Incorrect Approach

```typescript
// FORBIDDEN — the desktop drawer is not the mobile drawer, and the
// navigation lives in an off-canvas panel on a phone.
await browser.$('#left-panel a[href="#/addresses"]').click();

// FORBIDDEN — the leaf is inside a collapsed group with display: none and
// cannot be tapped at all.
await link.click();

// FORBIDDEN — the submit button is behind the software keyboard.
await (await login.submitButton()).click();

// FORBIDDEN — key-by-key typing is unreliable on a mobile browser.
for (const character of password) {
    await passwordField.keys(character);
}

// FORBIDDEN — there is no app to install; browserName is what selects the
// browser, and the session is configured in the platform configs.
capabilities: [{ app: '/path/to/Shipmondo.app' }]

// FORBIDDEN — the framework never installs the environment it targets.
"pretest": "appium driver install xcuitest && sdkmanager 'system-images;android-15;google_apis;x86_64'"
```

---

**Summary:** Mobile-first is not a style preference in this repository — it is the definition of the product under test. The target is the Shipmondo web app inside a mobile browser on a device that already exists; the interactions are touch-realistic; the DOM is the only source of truth; and the framework never installs what it targets.
