import { browser } from '@wdio/globals';
import { describeMobile, itMobile, expect, Tags, featureTag, title } from '../../src/shared';
import { collectFailures, expectNoFailures } from '../../src/shared/assertions';
import { useAuthenticatedApp, type AppContainer } from '../../src/mobile/fixtures';

/**
 * The address book on a mobile browser.
 *
 * The scenario coverage mirrors the desktop suite (tickets 3401–3404): the
 * route opens from the navigation drawer, the list agrees with the backing
 * endpoint, the endpoint answers cleanly, and an add-address control is
 * offered.
 *
 * The mobile adaptation: the route is reached through the off-canvas
 * drawer, and the add-address control is matched by its href rather than by
 * its role — the mobile theme renders it as an anchor styled as a button.
 */
describeMobile(
    'Address book',
    { features: [featureTag('address_book')], tags: [Tags.UI, Tags.REGRESSION, Tags.ADDRESS, Tags.MOBILE] },
    () => {
        let app: AppContainer;

        beforeEach(async () => {
            app = await useAuthenticatedApp();
        });

        itMobile(
            title(3401, 'opens the address book route'),
            { features: [featureTag('address_book')], tags: [Tags.REGRESSION] },
            async () => {
                await app.components.sidebar.navigateTo('Address book');

                await browser.waitUntil(async () => (await browser.getUrl()).includes('#/address-book'), {
                    timeout: 30_000,
                    timeoutMsg: 'The address book route did not open.',
                    interval: 500,
                });

                expect(await browser.getUrl()).toMatch(/#\/address-book/);
            },
        );

        itMobile(
            title(3402, 'lists the saved addresses'),
            { features: [featureTag('address_book')], tags: [Tags.REGRESSION] },
            async () => {
                await app.pages.addressBook.gotoAndWait();

                // The demo tenant has no saved addresses, so the list renders
                // the DataTables "no data" state. The assertion therefore
                // compares the rendered list against the backing endpoint
                // instead of assuming that rows exist.
                const apiRows = await app.services.appData.addressBookRows();
                const renderedNames = await app.pages.addressBook.visibleNames();

                expect(
                    renderedNames.length,
                    'the rendered list and the API disagree on the row count',
                ).toBe(apiRows.length);

                const failed = await collectFailures({
                    'the list is either empty or filled': async () => {
                        expect(await app.pages.addressBook.table.isEmpty()).toBe(apiRows.length === 0);
                    },
                    'the empty state names itself when there is nothing to show': async () => {
                        if (apiRows.length > 0) {
                            return;
                        }
                        const empty = await app.pages.addressBook.emptyMessage();
                        await expect(empty).toBeDisplayed();
                        expect(await empty.getText()).toMatch(/no data available/i);
                    },
                });

                expectNoFailures(failed, 'Address book checks failed');
            },
        );

        itMobile(
            title(3403, 'loads the regular receivers datatable without errors'),
            { features: [featureTag('address_book')], tags: [Tags.REGRESSION] },
            async () => {
                const rows = await app.services.appData.addressBookRows();

                expect(Array.isArray(rows)).toBe(true);
            },
        );

        itMobile(
            title(3404, 'shows an add-address control'),
            { features: [featureTag('address_book')], tags: [Tags.REGRESSION] },
            async () => {
                await app.pages.addressBook.gotoAndWait();

                const addButton = await app.pages.addressBook.addButton();
                await expect(addButton).toBeDisplayed();
            },
        );
    },
);
