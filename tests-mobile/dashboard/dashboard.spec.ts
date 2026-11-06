import { browser } from '@wdio/globals';
import { describeMobile, itMobile, expect, Tags, featureTag, title } from '../../src/shared';
import { collectFailures, expectNoFailures } from '../../src/shared/assertions';
import { useAuthenticatedApp, type AppContainer } from '../../src/mobile/fixtures';

/**
 * The dashboard on a mobile browser.
 *
 * The scenario coverage mirrors the desktop suite (tickets 3101–3106): the
 * route loads, the content area renders, the shortcut links to the main
 * sections exist, the section headings are there, the dashboard loads
 * without failing API calls, and the account record is reachable through the
 * app's own API.
 */
describeMobile(
    'Dashboard',
    { features: [featureTag('dashboard')], tags: [Tags.UI, Tags.SMOKE, Tags.MOBILE] },
    () => {
        let app: AppContainer;

        beforeEach(async () => {
            app = await useAuthenticatedApp();
        });

        itMobile(
            title(3101, 'loads the dashboard route'),
            { features: [featureTag('dashboard')], tags: [Tags.SMOKE] },
            async () => {
                expect(await browser.getUrl()).toMatch(/#\/dashboard/);
                expect(await app.pages.dashboard.getTitle()).toMatch(/dashboard/i);
            },
        );

        itMobile(
            title(3102, 'renders the main content area'),
            { features: [featureTag('dashboard')], tags: [Tags.SMOKE] },
            async () => {
                const content = await app.pages.dashboard.content();
                await expect(content).toBeDisplayed();
            },
        );

        itMobile(
            title(3103, 'links to the main sections from the dashboard'),
            { features: [featureTag('dashboard')], tags: [Tags.SMOKE] },
            async () => {
                // The Focus card carries the shortcut links. Each label has a
                // badge count appended ("Open orders 31"), so the match is a
                // prefix.
                const failed = await collectFailures({
                    'Shipments link': async () =>
                        expect(await app.pages.dashboard.hasShortcut('Shipments with issues')).toBe(true),
                    'Orders link': async () =>
                        expect(await app.pages.dashboard.hasShortcut('Open orders')).toBe(true),
                    'Drafts link': async () =>
                        expect(await app.pages.dashboard.hasShortcut('Drafts')).toBe(true),
                });

                expectNoFailures(failed, 'Missing dashboard links');
            },
        );

        itMobile(
            title(3104, 'renders section names on the dashboard'),
            { features: [featureTag('dashboard')], tags: [Tags.SMOKE] },
            async () => {
                const sections = await app.pages.dashboard.visibleSectionNames();

                expect(sections.length).toBeGreaterThan(0);
            },
        );
    },
);

describeMobile(
    'Dashboard — data consistency',
    { features: [featureTag('dashboard')], tags: [Tags.UI, Tags.REGRESSION, Tags.MOBILE] },
    () => {
        let app: AppContainer;

        beforeEach(async () => {
            app = await useAuthenticatedApp();
        });

        itMobile(
            title(3105, 'loads the dashboard without failing API calls'),
            { features: [featureTag('dashboard')], tags: [Tags.REGRESSION] },
            async () => {
                // The dashboard loads its counters from three JSON endpoints.
                // They are read from inside the mobile browser, so the
                // session cookie and the same-origin rules apply exactly as
                // they do to the app's own XHRs.
                const failures: string[] = [];

                for (const endpoint of [
                    '/api/v1/status_overview',
                    '/api/v1/resource_counts_overview',
                    '/api/v1/activity_chart',
                ]) {
                    const result = await browser.executeAsync(
                        (
                            url: string,
                            done: (result: { status: number }) => void,
                        ) => {
                            const xhr = new XMLHttpRequest();
                            xhr.open('GET', url, true);
                            xhr.setRequestHeader('X-Requested-With', 'XMLHttpRequest');
                            xhr.withCredentials = true;
                            xhr.onload = () => done({ status: xhr.status });
                            xhr.onerror = () => done({ status: 0 });
                            xhr.send();
                        },
                        endpoint,
                    );

                    if (result.status >= 400 || result.status === 0) {
                        failures.push(`${result.status} ${endpoint}`);
                    }
                }

                expectNoFailures(failures, 'Failing API calls');
            },
        );

        itMobile(
            title(3106, 'exposes the account record through the app API'),
            { features: [featureTag('dashboard')], tags: [Tags.REGRESSION] },
            async () => {
                const account = await app.services.appData.account();

                expect(account.email).toBeTruthy();
            },
        );
    },
);
