import { browser } from '@wdio/globals';
import { describeMobile, itMobile, expect, Tags, featureTag, title } from '../../src/shared';
import { useAuthenticatedApp, type AppContainer } from '../../src/mobile/fixtures';

/**
 * Booked shipments on a mobile browser.
 *
 * The scenario coverage mirrors the desktop suite (tickets 3201–3205): the
 * route loads, the table renders, the shipment ids are numeric, the column
 * headers are the expected ones, the backing datatable endpoint answers
 * cleanly, and the drafts route opens from the navigation drawer.
 *
 * The mobile adaptation: the list is a wide table inside a horizontally
 * scrollable region, so the values are read from the DOM rather than from
 * their rendered position, and the navigation is driven through the
 * off-canvas drawer.
 */
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

        itMobile(
            title(3202, 'renders the shipments table'),
            { features: [featureTag('shipments_list')], tags: [Tags.REGRESSION] },
            async () => {
                await app.pages.shipments.gotoAndWait();

                const table = await app.pages.shipments.tableElement();
                await expect(table).toBeDisplayed();

                // The ID column carries the shipment id, not a label.
                const ids = await app.pages.shipments.visibleShipmentIds();
                expect(ids.length).toBeGreaterThan(0);
                for (const id of ids) {
                    expect(id, `"${id}" is not a shipment id`).toMatch(/^\d+$/);
                }
            },
        );

        itMobile(
            title(3203, 'renders a column header for each list column'),
            { features: [featureTag('shipments_list')], tags: [Tags.REGRESSION] },
            async () => {
                await app.pages.shipments.gotoAndWait();

                const headers = await app.pages.shipments.table.headers();

                // The first column is the row-select checkbox and carries no
                // label.
                expect(headers).toEqual([
                    'ID',
                    'Name',
                    'Address',
                    'City',
                    'Country',
                    'Type',
                    'Created',
                    'Via',
                    'More',
                ]);
            },
        );

        itMobile(
            title(3204, 'loads the shipments datatable without errors'),
            { features: [featureTag('shipments_list')], tags: [Tags.REGRESSION] },
            async () => {
                const rows = await app.services.appData.shipmentRows();

                expect(rows.length).toBeGreaterThan(0);
                for (const row of rows) {
                    expect(typeof row.id, 'the shipment id must be numeric').toBe('number');
                    expect(typeof row.reference, 'every shipment carries a reference').toBe('string');
                    expect(row.receiver_country, 'the receiver country is a two-letter code').toHaveLength(
                        2,
                    );
                    expect(typeof row.created_at, 'every shipment carries a creation timestamp').toBe(
                        'string',
                    );
                }
            },
        );
    },
);

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
            title(3205, 'opens the drafts route from the navigation drawer'),
            { features: [featureTag('shipments_drafts')], tags: [Tags.REGRESSION] },
            async () => {
                // On a phone the navigation is an off-canvas drawer: the
                // component opens it, expands the owning group and taps the
                // leaf link.
                await app.components.sidebar.navigateTo('Drafts');

                await browser.waitUntil(async () => (await browser.getUrl()).includes('#/shipping-label-drafts'), {
                    timeout: 30_000,
                    timeoutMsg: 'The drafts route did not open.',
                    interval: 500,
                });

                expect(await browser.getUrl()).toMatch(/#\/shipping-label-drafts/);
            },
        );
    },
);
