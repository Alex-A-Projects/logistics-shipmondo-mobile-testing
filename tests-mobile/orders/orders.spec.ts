import { browser } from '@wdio/globals';
import { describeMobile, itMobile, expect, Tags, featureTag, title } from '../../src/shared';
import { useAuthenticatedApp, type AppContainer } from '../../src/mobile/fixtures';

/**
 * Sales orders on a mobile browser.
 *
 * The scenario coverage mirrors the desktop suite (tickets 3301–3306): the
 * route loads, the table renders, the order ids are numeric, the backing
 * datatable endpoint answers cleanly, and the dashboard shortcuts apply the
 * open-orders and on-hold filters.
 */
describeMobile(
    'Orders',
    { features: [featureTag('orders')], tags: [Tags.UI, Tags.REGRESSION, Tags.ORDER, Tags.MOBILE] },
    () => {
        let app: AppContainer;

        beforeEach(async () => {
            app = await useAuthenticatedApp();
        });

        itMobile(
            title(3301, 'loads the orders route'),
            { features: [featureTag('orders')], tags: [Tags.REGRESSION] },
            async () => {
                await app.pages.orders.gotoAndWait();

                expect(await browser.getUrl()).toMatch(/#\/orders/);
            },
        );

        itMobile(
            title(3302, 'renders the orders table'),
            { features: [featureTag('orders')], tags: [Tags.REGRESSION] },
            async () => {
                await app.pages.orders.gotoAndWait();

                const table = await app.pages.orders.tableElement();
                await expect(table).toBeDisplayed();
            },
        );

        itMobile(
            title(3303, 'renders order ids in the first column'),
            { features: [featureTag('orders')], tags: [Tags.REGRESSION] },
            async () => {
                await app.pages.orders.gotoAndWait();

                // The demo tenant is seeded with orders; the table must
                // expose them. Column 2 holds the order number — the shop's
                // own reference for the order, not a label.
                const orderIds = await app.pages.orders.visibleOrderIds();

                expect(orderIds.length).toBeGreaterThan(0);
                for (const orderId of orderIds) {
                    expect(orderId, `"${orderId}" is not an order number`).toMatch(/^\d+$/);
                }
            },
        );

        itMobile(
            title(3304, 'loads the sales orders datatable without errors'),
            { features: [featureTag('orders')], tags: [Tags.REGRESSION] },
            async () => {
                const rows = await app.services.appData.salesOrderRows();

                expect(rows.length).toBeGreaterThan(0);
                for (const row of rows) {
                    expect(typeof row.id, 'the order id must be numeric').toBe('number');
                    expect(row.order_status, 'every order carries a status').toBeTruthy();
                    expect(row.payment_status, 'every order carries a payment status').toBeTruthy();
                    expect(typeof row.external_document_id, 'every order carries an order number').toBe(
                        'string',
                    );
                    expect(row.currency_code, 'the currency is an ISO code').toHaveLength(3);
                }
            },
        );

        itMobile(
            title(3305, 'applies the open-orders filter from the dashboard shortcut'),
            { features: [featureTag('orders')], tags: [Tags.REGRESSION] },
            async () => {
                await app.pages.dashboard.gotoAndWait();
                await app.pages.dashboard.openShortcut('Open orders');

                await browser.waitUntil(async () => (await browser.getUrl()).includes('#/orders?filters='), {
                    timeout: 30_000,
                    timeoutMsg: 'The open-orders filter was not applied.',
                    interval: 500,
                });

                expect(await browser.getUrl()).toMatch(/#\/orders\?filters=/);
            },
        );

        itMobile(
            title(3306, 'applies the on-hold filter from the dashboard shortcut'),
            { features: [featureTag('orders')], tags: [Tags.REGRESSION] },
            async () => {
                await app.pages.dashboard.gotoAndWait();
                await app.pages.dashboard.openShortcut('Orders on hold');

                await browser.waitUntil(async () => (await browser.getUrl()).includes('#/orders?filters='), {
                    timeout: 30_000,
                    timeoutMsg: 'The on-hold filter was not applied.',
                    interval: 500,
                });

                expect(await browser.getUrl()).toMatch(/#\/orders\?filters=/);
            },
        );
    },
);
