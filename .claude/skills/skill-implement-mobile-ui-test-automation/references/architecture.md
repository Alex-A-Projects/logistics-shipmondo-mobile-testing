# Architecture — the layer model

## Overview

The suite is a strict four-layer model with one shared layer in front of it. Every file belongs to exactly one layer, and the dependency arrows only ever point downwards.

```
┌─────────────────────────────────────────────────────────────┐
│  tests-mobile/**/*.spec.ts          the test layer           │
│  AAA · tags · ticket titles · the only `expect` calls      │
└───────────────┬─────────────────────────────────────────────┘
                │  imports
┌───────────────▼─────────────────────────────────────────────┐
│  src/mobile/fixtures/index.ts        the fixture layer      │
│  useAuthenticatedApp() · useSignedOutApp() · browser.app    │
└───────────────┬─────────────────────────────────────────────┘
                │  returns AppContainer
┌───────────────▼─────────────────────────────────────────────┐
│  src/mobile/fixtures/app-container.ts  the composition root │
│  { pages, components, services }                            │
└───┬───────────────────────┬──────────────────────┬─────────┘
    │                       │                      │
┌───▼──────────────┐  ┌─────▼───────────────┐  ┌──▼──────────────────┐
│ pages/           │  │ components/         │  │ services/           │
│ one per route    │  │ shell regions       │  │ flows + internal    │
│ BasePage subclass│  │ BaseComponent       │  │ JSON API            │
└───┬──────────────┘  └─────┬───────────────┘  └──┬──────────────────┘
    │                       │                      │
    └───────────────────────┴──────────────┬───────┘
                                           │  reads
                              ┌────────────▼─────────────┐
                              │ src/mobile/selectors.ts  │
                              │ the verified DOM contract │
                              └──────────────────────────┘
```

The shared layer (`src/shared/`) sits beside the mobile layer and is imported by both. It knows nothing about Shipmondo's DOM and nothing about devices: it provides the vocabulary — environment, tags, titles, policy, expectations, assertions, paths, generators.

---

## Layer rules — enforce always

### The test layer — `tests-mobile/**/*.spec.ts`

- **AAA** — Arrange, Act, Assert.
- **One behaviour per test.** A case that verifies three things is three cases.
- **No selectors.** A spec never writes `browser.$('#content')`. It asks the container for a page, a component or a service.
- **Every `expect` lives here.** Nowhere else.
- **Tags come from `src/shared/tags.ts`.** Never inline `'@smoke'`.
- **Titles come from `title()` in `src/shared/titles.ts`.** `title(3601, 'runs in the mobile browser of the target device')`.

### The fixture layer — `src/mobile/fixtures/`

- **WebdriverIO has no fixture-injection arguments.** The fixtures are therefore plain async functions that a spec calls from its own `beforeEach` and keeps the returned container.
- **Two entry points only**: `useAuthenticatedApp()` and `useSignedOutApp()`.
- **The fixture provides; the spec asserts.** A fixture never calls `expect`.
- **The container is published on `browser.app`** so a helper that has no access to the spec's local variable can still reach the pages.

### The composition root — `src/mobile/fixtures/app-container.ts`

`createAppContainer()` builds the whole object graph: pages, components, services. It holds no state of its own — the browser session is the state — so it is cheap to build per test and a test can never see a page object configured for a different session.

Dependency order inside the container: **services → pages → components**. A component is composed into a page (a page exposes `get table(): DatatableComponent`), and a page is composed into the container.

### The page layer — `src/mobile/pages/`

- **One class per route.** `LoginPage`, `DashboardPage`, `ShipmentsPage`, `OrdersPage`, `AddressBookPage`, `SettingsPage`.
- **Extends `BasePage`**, which supplies `path`, `readySelector`, `goto()`, `gotoAndWait()`, `waitForReady()`, `isCurrentRoute()`, `currentUrl()`, `getTitle()`.
- **Zero assertions.** The one wait inside `waitForReady()` is a precondition of the page being usable, not a verification of behaviour.
- **The ready selector is route-specific.** The SPA swaps `#content` in place, so a generic `#content` selector matches the *previous* route's content and makes the wait a no-op.

### The component layer — `src/mobile/components/`

- **A component is a reusable region of the shell**, not a route: the sidebar drawer, the top bar, the datatable, the flash message, the mobile shell itself.
- **Extends `BaseComponent`**, which supplies `waitForExist()`, `waitForDisplayed()`, `exists()`, `isDisplayed()`, `text()` and the protected `textsOf()`.
- **Zero assertions.** The component exposes state and performs actions; the spec decides whether the state is correct.
- **No fixed sleeps.** Every wait is anchored on a condition the app controls.

### The service layer — `src/mobile/services/`

- **Business operations and data access** — the sign-in flow, the session capture and replay, and the app's own internal JSON API.
- **Never imports a page object.** `AuthService` is the one exception in spirit only: it constructs a `LoginPage` and a `TopbarComponent` internally, because driving the real login form *is* its job. It does not import from `src/mobile/pages/`'s public API to reach the DOM for another purpose.
- **Zero assertions.** The service returns data; the spec decides.

### The selector layer — `src/mobile/selectors.ts`

- **The only module that knows the DOM.** Every selector lives here, with the reasoning for its shape.
- **No logic.** The file exports constants and two small functions (`routeContent`, `routeTableXPath`).

---

## Two patterns that carry the whole design

### Facade — the container

`AppContainer` is a facade over the pages, the components and the services. A spec never assembles the graph itself; it asks for the container and gets a coherent set of collaborators.

```ts
const container = createAppContainer();
container.pages.dashboard.content();
container.components.sidebar.navigateTo('Address book');
container.services.appData.addressBookRows();
```

### Strategy — the device profile

`config/devices.ts` describes each target as a `DeviceProfile`: the platform, the Appium driver, the browser, the device name, the OS version, the viewport and the user-agent fragment the browser must report. The platform configs read the profile and spread it into the capabilities; the specs read the profile to assert the right expectation for the running platform.

```ts
const platform = String(browser.capabilities.platformName ?? '').toLowerCase();
const profile = platform.startsWith('ios') ? IOS_DEVICE : ANDROID_DEVICE;

const viewport = await app.components.mobile.viewport();
expect(
    Math.abs(viewport.width - profile.viewport.width),
    `the viewport is ${viewport.width}px, the ${profile.deviceName} profile expects ~${profile.viewport.width}px`,
).toBeLessThanOrEqual(80);
```

The same spec therefore asserts the right thing on an iPhone and on a Galaxy, without branching on the platform anywhere else.

### Factory — the container builder

`createAppContainer()` is the factory. It exists so that a fresh set of page objects, components and services can be built per test at zero cost, and so that the graph is described in exactly one place.

---

## The two facts that shape every selector

The Shipmondo DOM carries **no** `data-testid` attribute, so every selector is derived from the real markup. Two structural facts drive most of them:

1. **Every list renders its table twice** — a header-only clone (`table.dataTable`, no rows) and the scrolling body table that owns the rows. Only the body table holds data. This is why `routeTableXPath()` is an XPath rather than CSS: Appium's selector engines (XCUITest and UiAutomator2) do not implement the CSS `:has()` pseudo-class consistently, and the XPath `//table[contains(@class,"dataTable")][.//tbody/tr]` picks the body table on both platforms.

2. **Column 1 of every list is the row-select checkbox column**, so the first *meaningful* column is column 2. The API-access list is the exception — it has no checkbox column, so its name is column 1.

---

## The mobile-web facts that shape every interaction

- The left navigation is an **off-canvas drawer** (`#left-panel`) behind a hamburger toggle. The shell adds `body.mobile-view-activated` while it is open.
- A closed drawer still reports `isDisplayed() === true` — it is merely translated outside the viewport. Reachability is decided from the element's rectangle (`SidebarComponent.isDrawerOpen()`).
- Navigation groups are **accordions**: opening one collapses the others, and a leaf link is invisible until its group is expanded. Groups must be expanded outermost first.
- The header is **condensed**: the account name lives behind the profile avatar, which opens a dropdown.
- The app is a **hash-routed AngularJS SPA** under `/main/app/`. Navigating between app routes is a same-document navigation: the session cookie survives and the shell does not reload — which matters a great deal over a mobile link.

---

## Anti-patterns — never introduce

- An `expect` call anywhere outside `tests-mobile/`.
- A selector literal in a spec file.
- A service that imports a page object to reach the DOM for a purpose other than driving a real form.
- A component that duplicates a selector that already exists in `src/mobile/selectors.ts`.
- A route-agnostic ready selector (`#content`), which matches the previous route and makes the wait a no-op.
- Global mutable state between tests. The only state the suite shares is the worker session cookie replay in `src/mobile/fixtures/index.ts`, and it is held in memory only.
- A sleep. Ever.
- A second `BasePage` hierarchy — one base class is enough.
- Re-issuing `browser.url()` to a route the browser is already on: `BasePage.goto()` skips it deliberately.
