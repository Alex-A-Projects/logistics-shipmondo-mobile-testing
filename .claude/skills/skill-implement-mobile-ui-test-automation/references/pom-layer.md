# The POM layer — pages and components

## Table of contents

1. [Pages versus components](#pages-versus-components)
2. [`BasePage`](#basepage)
3. [`BaseComponent`](#basecomponent)
4. [Writing a page object](#writing-a-page-object)
5. [Adding a route](#adding-a-route)
6. [Adding a shell region](#adding-a-shell-region)
7. [Condition-based waits](#condition-based-waits)
8. [Selector rules](#selector-rules)
9. [Anti-patterns](#anti-patterns)

---

## Pages versus components

| | Page | Component |
|---|---|---|
| Represents | a **route** of the SPA | a **reusable region** of the shell |
| Lives in | `src/mobile/pages/` | `src/mobile/components/` |
| Extends | `BasePage` | `BaseComponent` |
| Examples | `DashboardPage`, `ShipmentsPage` | `SidebarComponent`, `TopbarComponent`, `DatatableComponent` |
| Composed into | the container | a page (`get table(): DatatableComponent`) |

The decision is simple: if it has a URL fragment, it is a page. If it is a region that appears on several screens, it is a component.

---

## `BasePage`

```ts
export abstract class BasePage {
    /** The route path, relative to the base URL. */
    protected abstract readonly path: string;

    /**
     * Selector for the element that signals the page has finished loading.
     *
     * Must be **specific to this route**: the app swaps the content region
     * in place, so a generic selector such as `#content` would match the
     * *previous* route's content and make the wait a no-op.
     */
    protected abstract readonly readySelector: string;
}
```

It supplies:

| Member | Behaviour |
|---|---|
| `goto()` | Navigates to `path`. **Skips the navigation when the browser is already on the target hash route** — re-issuing it is a no-op at the URL level but a full shell reload in practice, and a reloaded list route does not always repaint its table. |
| `gotoAndWait()` | `goto()` followed by `waitForReady()`. |
| `waitForReady()` | `waitForDisplayed` on `readySelector`, with a timeout message that names the selector. |
| `isCurrentRoute()` | Substring check on `browser.getUrl()` against the hash fragment. |
| `currentUrl()` | `browser.getUrl()`. |
| `getTitle()` | `browser.getTitle()` — Shipmondo sets the tab title per route. |

---

## `BaseComponent`

```ts
export abstract class BaseComponent {
    protected abstract get root(): ChainablePromiseElement;

    async waitForExist(timeout = timeouts.waitForDisplayed): Promise<void>
    async waitForDisplayed(timeout = timeouts.waitForDisplayed): Promise<void>
    async exists(): Promise<boolean>
    async isDisplayed(): Promise<boolean>
    async text(): Promise<string | undefined>
    protected async textsOf(selector: string): Promise<string[]>
}
```

`text()` returns `undefined` when the component is not rendered — not an empty string — so a caller can distinguish "not there" from "there but blank".

The module also exports three convenience helpers used across the components:

```ts
export async function find(selector: string): Promise<ChainablePromiseElement>
export async function findAll(selector: string): Promise<ChainablePromiseArray>
export async function countOf(selector: string): Promise<number>
export async function waitUntil(
    condition: () => boolean | Promise<boolean>,
    timeout = timeouts.waitForDisplayed,
    description = 'condition',
): Promise<void>
```

`countOf()` resolves the element list through `getElements()` before counting, because the enhanced list's `length` is typed as a promise by WebdriverIO.

---

## Writing a page object

```ts
import { browser } from '@wdio/globals';
import { BasePage } from './base.page';
import { SEARCH_INPUT, routeTableXPath } from '../selectors';
import { DatatableComponent } from '../components/datatable.component';

export class ShipmentsPage extends BasePage {
    protected readonly path = '/main/app/#/shipping-labels';

    /**
     * The route's own datatable, with at least one row. Scoping the wait to
     * the route is what keeps it from matching the previous route's table,
     * which is still in the DOM until the new view is attached.
     */
    protected readonly readySelector = routeTableXPath('shipments');

    /** The list component of this route. */
    get table(): DatatableComponent {
        return new DatatableComponent('shipments');
    }

    /** The search/filter input above the list. */
    async searchInput() {
        return browser.$(SEARCH_INPUT);
    }

    /** The data-bearing table element. */
    async tableElement() {
        return browser.$(routeTableXPath('shipments'));
    }

    /**
     * The shipment ids visible in the current page of results.
     *
     * The id is the second rendered column (the first is the checkbox).
     */
    async visibleShipmentIds(): Promise<string[]> {
        return this.table.columnValues(1);
    }
}
```

Four rules hold for every page object:

1. **Zero assertions.** The page exposes state and performs actions; the spec decides what is correct.
2. **Locators live in `src/mobile/selectors.ts`.** The page imports them; it does not invent string literals.
3. **The ready selector is route-scoped.**
4. **Methods return data, not verdicts.** `visibleShipmentIds()` returns the ids; it does not check that they are numeric.

---

## Adding a route

To add a new screen to the suite:

1. **Add the route class to `src/mobile/selectors.ts`.**

```ts
export const ROUTE_CONTENT_CLASS = {
    dashboard: 'dashboard',
    orders: 'order-content',
    shipments: 'shipping-labels-content',
    shipmentDrafts: 'shipping-label-draft-content',
    addressBook: 'address-book-content',
    apiAccess: 'api-credential-content',
} as const;

export type RouteKey = keyof typeof ROUTE_CONTENT_CLASS;
```

`RouteKey` is derived from the map, so adding an entry automatically widens the type used by `routeContent()`, `routeTableXPath()` and `routeContentXPath()`, and by `DatatableComponent`'s constructor.

2. **Create the page object** in `src/mobile/pages/<name>.page.ts`:

```ts
export class LabelsPage extends BasePage {
    protected readonly path = '/main/app/#/labels';
    protected readonly readySelector = routeTableXPath('labels');

    async tableElement() {
        return browser.$(routeTableXPath('labels'));
    }
}
```

3. **Register it in the container** — `src/mobile/fixtures/app-container.ts`:

```ts
export interface AppPages {
    login: LoginPage;
    dashboard: DashboardPage;
    shipments: ShipmentsPage;
    orders: OrdersPage;
    addressBook: AddressBookPage;
    settings: SettingsPage;
    labels: LabelsPage;          // ← new
}

export function createAppContainer(): AppContainer {
    return {
        pages: {
            login: new LoginPage(),
            dashboard: new DashboardPage(),
            shipments: new ShipmentsPage(),
            orders: new OrdersPage(),
            addressBook: new AddressBookPage(),
            settings: new SettingsPage(),
            labels: new LabelsPage(),   // ← new
        },
        // ...
    };
}
```

4. **Declare the feature** in `config/test-policy.json` — under **every** environment the suite runs against — and then reference it with `featureTag()`.

5. **Export it** from `src/mobile/index.ts` if a spec needs the class directly.

---

## Adding a shell region

To add a component that appears on several screens:

1. **Extend `BaseComponent`** and implement `root`.

```ts
import { browser } from '@wdio/globals';
import { BaseComponent } from './base.component';
import { FOOTER_LINKS } from '../selectors';

export class FooterComponent extends BaseComponent {
    protected get root() {
        return browser.$(FOOTER_LINKS);
    }

    /** The links in the footer. */
    async links() {
        return browser.$$(`${FOOTER_LINKS} a`);
    }
}
```

2. **Register it in the container** under `AppComponents`.

3. **Compose it into the pages that show it** — a page exposes it as a getter, so the component stays a separate object with its own tests:

```ts
export class OrdersPage extends BasePage {
    protected readonly path = '/main/app/#/orders';
    protected readonly readySelector = routeTableXPath('orders');

    get footer(): FooterComponent {
        return new FooterComponent();
    }
}
```

4. **Export it** from `src/mobile/index.ts`.

The components that exist today:

| Component | Region |
|---|---|
| `SidebarComponent` | The off-canvas navigation drawer |
| `TopbarComponent` | The condensed header: account menu, environment badge, sign out |
| `DatatableComponent` | The DataTables-style list, addressed per route |
| `FlashMessageComponent` | The Bootstrap alerts rendered after an action |
| `MobileShellComponent` | The mobile browser itself: user agent, viewport, touch support, scrollability |

---

## Condition-based waits

**Never a sleep.** Every wait in this layer is anchored on a condition the app controls.

### An element becomes visible

```ts
const error = await app.pages.login.errorMessage();
await error.waitForDisplayed({
    timeout: 30_000,
    timeoutMsg: 'The login form did not report the rejected password.',
});
```

### A state in the DOM changes

```ts
await browser.waitUntil(
    async () => this.isDrawerOpen(),
    {
        timeout: 10_000,
        timeoutMsg: 'The navigation drawer did not open after tapping the toggle.',
        interval: 200,
    },
);
```

### An element is scrolled into view before it is tapped

This is the mobile keyboard problem. On a phone the software keyboard covers the lower half of the screen, so the submit button may be behind it:

```ts
async submit(): Promise<void> {
    const button = await this.submitButton();
    await button.waitForDisplayed({ timeout: 10_000 });
    await browser.execute((selector: string) => {
        const element = document.querySelector(selector);
        if (element) {
            element.scrollIntoView({ block: 'center', inline: 'center' });
        }
    }, LOGIN_SUBMIT);
    await button.click();
}
```

### The route's own content replaces the previous route's

The SPA swaps `#content` in place. The previous route's DOM is still present until the new view is attached, so a route-agnostic selector silently matches stale content. This is why `routeTableXPath()` and `routeContent()` exist.

---

## Selector rules

- **Every selector literal lives in `src/mobile/selectors.ts`.**
- **Use XPath when CSS `:has()` would be needed.** Appium's selector engines — XCUITest on iOS and UiAutomator2 on Android — do not implement `:has()` consistently.
- **Scope list selectors to the body table.** Every list renders a header-only clone and a body table; only the body table owns a `tbody` with rows.
- **Remember the checkbox column.** Column 1 of every list is the row-select checkbox; the first meaningful column is column 2. The API-access list is the exception.
- **Prefer one `browser.execute` over many protocol round trips.** On a mobile browser each element lookup is a network hop. `DatatableComponent.headers()` and `.rows()` read the whole table in a single call.

---

## Anti-patterns

- An `expect` in a page object or a component.
- A selector literal inside a page object.
- A route-agnostic `readySelector`.
- A `setTimeout`, a `pause()` or a sleep.
- Returning a boolean verdict from a page method (`isShipmentsListCorrect()`) — return the data and let the spec judge it.
- Duplicating a component that already exists — extract it instead.
- A second base-class hierarchy — one `BasePage`, one `BaseComponent`.
- Re-issuing `browser.url()` to the route the browser is already on — `BasePage.goto()` deliberately skips it.
