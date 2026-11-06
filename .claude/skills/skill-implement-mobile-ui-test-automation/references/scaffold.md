# Scaffold — adding a new spec, page and selectors

The copy-paste skeleton for adding a new case to the suite. Four files are involved, in this order: **selectors → page object → container → spec**.

The worked example adds the shipment-drafts list, which the suite already navigates to from the drawer (`tests-mobile/shipments/booked-shipments.spec.ts`, ticket SHIP-3205) but does not yet have a page object for. The new case verifies that the drafts list renders its own table: *"the drafts list renders a table of its own"*.

---

## 1. The selectors — `src/mobile/selectors.ts`

Add the selector next to its siblings, with the reasoning in the comment. The file is the only place that knows the DOM, and every selector in it was verified against the live demo app.

The draft route is already declared:

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

So a new route needs **no** selector change at all: `routeContent('shipmentDrafts')` and `routeTableXPath('shipmentDrafts')` already work, because `RouteKey` is derived from the map.

Only add a constant when the new case needs a control that no existing selector covers. Verify it against the live DOM first, and say so in the comment:

```ts
/**
 * The status cell of a shipment draft row.
 *
 * Verified against the live demo app: each draft row carries a status
 * label in its third rendered column.
 */
export const DRAFT_STATUS = '#content.shipping-label-draft-content tbody tr td:nth-child(3)';
```

---

## 2. The page object — `src/mobile/pages/shipment-drafts.page.ts`

```ts
import { browser } from '@wdio/globals';
import { BasePage } from './base.page';
import { SEARCH_INPUT, routeTableXPath } from '../selectors';
import { DatatableComponent } from '../components/datatable.component';

/**
 * Shipment drafts (`#/shipping-label-drafts`).
 *
 * The page renders a DataTables-style list of the shipments that have been
 * prepared but not yet booked.
 *
 * Mobile adaptation
 * -----------------
 * The list is a wide table inside a horizontally scrollable region. The
 * column widths are squeezed on a phone, so the *values* are read from the
 * DOM rather than from their rendered position, and the table itself is
 * addressed through the route-scoped XPath (CSS `:has()` is not reliably
 * implemented by Appium's selector engines).
 */
export class ShipmentDraftsPage extends BasePage {
    protected readonly path = '/main/app/#/shipping-label-drafts';

    /**
     * The route's own datatable, with at least one row. Scoping the wait to
     * the route is what keeps it from matching the previous route's table,
     * which is still in the DOM until the new view is attached.
     */
    protected readonly readySelector = routeTableXPath('shipmentDrafts');

    /** The list component of this route. */
    get table(): DatatableComponent {
        return new DatatableComponent('shipmentDrafts');
    }

    /** The search/filter input above the list. */
    async searchInput() {
        return browser.$(SEARCH_INPUT);
    }

    /** The data-bearing table element. */
    async tableElement() {
        return browser.$(routeTableXPath('shipmentDrafts'));
    }

    /** The statuses of the rendered draft rows. */
    async visibleStatuses(): Promise<string[]> {
        return this.table.columnValues(2);
    }
}
```

Checklist for a page object:

- extends `BasePage`;
- declares `path` and a **route-scoped** `readySelector`;
- zero assertions;
- every selector imported from `src/mobile/selectors.ts`;
- a mobile-adaptation note in the class comment.

---

## 3. The container — `src/mobile/fixtures/app-container.ts`

```ts
import { ShipmentDraftsPage } from '../pages/shipment-drafts.page';

export interface AppPages {
    login: LoginPage;
    dashboard: DashboardPage;
    shipments: ShipmentsPage;
    shipmentDrafts: ShipmentDraftsPage;   // ← new
    orders: OrdersPage;
    addressBook: AddressBookPage;
    settings: SettingsPage;
}

export function createAppContainer(): AppContainer {
    return {
        pages: {
            login: new LoginPage(),
            dashboard: new DashboardPage(),
            shipments: new ShipmentsPage(),
            shipmentDrafts: new ShipmentDraftsPage(),   // ← new
            orders: new OrdersPage(),
            addressBook: new AddressBookPage(),
            settings: new SettingsPage(),
        },
        components: {
            sidebar: new SidebarComponent(),
            topbar: new TopbarComponent(),
            datatable: new DatatableComponent('shipments'),
            flash: new FlashMessageComponent(),
            mobile: new MobileShellComponent(),
        },
        services: {
            auth: new AuthService(),
            appData: new AppDataService(),
        },
    };
}
```

Then export the class from the mobile barrel, `src/mobile/index.ts`:

```ts
export * from './pages/shipment-drafts.page';
```

---

## 4. The spec — `tests-mobile/shipments/shipment-drafts.spec.ts`

```ts
import { browser } from '@wdio/globals';
import { describeMobile, itMobile, expect, Tags, featureTag, title } from '../../src/shared';
import { useAuthenticatedApp, type AppContainer } from '../../src/mobile/fixtures';

/**
 * Shipment drafts on a mobile browser.
 *
 * The mobile adaptation: the route is reached through the off-canvas
 * navigation drawer — open the drawer, expand the owning group, tap the
 * leaf — and the list is a wide table inside a horizontally scrollable
 * region, so the values are read from the DOM rather than from their
 * on-screen position.
 */
describeMobile(
    'Shipment drafts',
    {
        features: [featureTag('shipments_drafts')],
        tags: [Tags.UI, Tags.REGRESSION, Tags.SHIPMENT, Tags.MOBILE],
    },
    () => {
        let app: AppContainer;

        beforeEach(async () => {
            app = await useAuthenticatedApp();
        });

        itMobile(
            title(3206, 'renders a table of its own on the drafts route'),
            { features: [featureTag('shipments_drafts')], tags: [Tags.REGRESSION, Tags.MOBILE] },
            async () => {
                await app.pages.shipmentDrafts.gotoAndWait();

                const table = await app.pages.shipmentDrafts.tableElement();
                await expect(table).toBeDisplayed();

                expect(await browser.getUrl()).toMatch(/#\/shipping-label-drafts/);
            },
        );

        itMobile(
            title(3207, 'opens the drafts route from the navigation drawer'),
            { features: [featureTag('shipments_drafts')], tags: [Tags.REGRESSION, Tags.MOBILE] },
            async () => {
                // On a phone the navigation is an off-canvas drawer: the
                // component opens it, expands the owning group and taps the
                // leaf link.
                await app.components.sidebar.navigateTo('Drafts');

                await browser.waitUntil(
                    async () => (await browser.getUrl()).includes('#/shipping-label-drafts'),
                    {
                        timeout: 30_000,
                        timeoutMsg: 'The drafts route did not open.',
                        interval: 500,
                    },
                );

                expect(await browser.getUrl()).toMatch(/#\/shipping-label-drafts/);
            },
        );
    },
);
```

### The spec checklist

- imports `describeMobile`, `itMobile`, `expect`, `Tags`, `featureTag`, `title` from `../../src/shared`;
- imports `collectFailures` / `expectNoFailures` from `../../src/shared/assertions` when it needs them;
- imports the fixture from `../../src/mobile/fixtures`;
- every `itMobile` title comes from `title()`;
- every `itMobile` declares a feature tag that exists in `config/test-policy.json`;
- at least one execution-tier tag plus `Tags.MOBILE`;
- the assertions live here and nowhere else.

---

## 5. The feature — `config/test-policy.json`

If the case belongs to a feature that is not yet declared, add it under **every** environment the suite runs against:

```json
{
  "envs": {
    "demo": {
      "features": {
        "auth": true,
        "dashboard": true,
        "shipments_list": true,
        "shipments_drafts": true,
        "orders": true,
        "address_book": true,
        "api_access": true,
        "account_settings": true,
        "mobile_web": true,
        "mobile_navigation": true
      }
    }
  }
}
```

A feature that is present but `false` **skips** the test. A feature that is **absent** fails the run at collection time. Both are deliberate: the first is a decision, the second is a defect.

`shipments_drafts` is already declared for `demo`, `staging` and `release`, so the example above needs no policy change.

---

## 6. Verify

```bash
npm run typecheck
npm run test:ios -- --spec tests-mobile/shipments/shipment-drafts.spec.ts
npm run test:android -- --spec tests-mobile/shipments/shipment-drafts.spec.ts
npm run allure:serve
```

Type-check first: `noUnusedLocals`, `noImplicitReturns` and `strict` will catch an unused import, a missing return path and a loosely typed value before the device is ever started.

---

## The complete file list for a new feature

| File | Status |
|---|---|
| `src/mobile/selectors.ts` | a new selector, or a new route class in `ROUTE_CONTENT_CLASS` |
| `src/mobile/pages/<name>.page.ts` | new |
| `src/mobile/components/<name>.component.ts` | new, only if the region is reusable across routes |
| `src/mobile/services/<name>.service.ts` | new, only if there is a flow or a data operation to encapsulate |
| `src/mobile/fixtures/app-container.ts` | register the new page or component |
| `src/mobile/index.ts` | export the new class |
| `src/mobile/models/<name>.model.ts` | new, only if there is a payload to type |
| `tests-mobile/<area>/<feature>.spec.ts` | new, or extend the existing one |
| `config/test-policy.json` | declare the feature, if it is new |

Nothing else changes. The runner, the fixtures, the reporter and the policy engine are already in place.
