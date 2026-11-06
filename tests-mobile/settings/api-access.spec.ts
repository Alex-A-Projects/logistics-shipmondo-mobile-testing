import { browser } from '@wdio/globals';
import { describeMobile, itMobile, expect, Tags, featureTag, title } from '../../src/shared';
import { useAuthenticatedApp, type AppContainer } from '../../src/mobile/fixtures';

/**
 * The API-access settings on a mobile browser.
 *
 * The scenario coverage mirrors the desktop suite (tickets 3501–3503): the
 * route opens from the navigation drawer, the rendered list agrees with the
 * backing endpoint, and a create-API-access action is offered.
 *
 * The mobile adaptation: the route is reached through the off-canvas
 * drawer, where "API" lives two groups deep (Settings → Integrations).
 */
describeMobile(
    'API access settings',
    { features: [featureTag('api_access')], tags: [Tags.UI, Tags.REGRESSION, Tags.AUTH, Tags.MOBILE] },
    () => {
        let app: AppContainer;

        beforeEach(async () => {
            app = await useAuthenticatedApp();
        });

        itMobile(
            title(3501, 'opens the API access settings route'),
            { features: [featureTag('api_access')], tags: [Tags.REGRESSION] },
            async () => {
                await app.components.sidebar.navigateTo('API');

                await browser.waitUntil(async () => (await browser.getUrl()).includes('#/setting/api'), {
                    timeout: 30_000,
                    timeoutMsg: 'The API access route did not open.',
                    interval: 500,
                });

                expect(await browser.getUrl()).toMatch(/#\/setting\/api/);
            },
        );

        itMobile(
            title(3502, 'lists the API access entries for the account'),
            { features: [featureTag('api_access')], tags: [Tags.REGRESSION] },
            async () => {
                await app.pages.settings.gotoAndWait();

                // The API-access list has no row-select column, so the name
                // is the first column (unlike the other lists, where it is
                // the second).
                const rendered = await app.pages.settings.apiAccessNames();
                const rows = await app.services.appData.apiAccessRows();

                // The rendered list and the endpoint the list was filled from
                // must agree — the same check, at the same moment, of the
                // same data.
                expect(rendered).toEqual(rows.map((row) => row.name));
                expect(rendered.length).toBeGreaterThan(0);
            },
        );

        itMobile(
            title(3503, 'offers a create-API-access action'),
            { features: [featureTag('api_access')], tags: [Tags.REGRESSION] },
            async () => {
                await app.pages.settings.gotoAndWait();

                const create = await app.pages.settings.createAccessButton();
                await expect(create).toBeDisplayed();
            },
        );
    },
);
