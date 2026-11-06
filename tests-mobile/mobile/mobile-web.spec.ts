import { browser } from '@wdio/globals';
import { describeMobile, itMobile, expect, Tags, featureTag, title } from '../../src/shared';
import { collectFailures, expectNoFailures } from '../../src/shared/assertions';
import { useAuthenticatedApp, type AppContainer } from '../../src/mobile/fixtures';
import { ANDROID_DEVICE, IOS_DEVICE } from '../../config/devices';

/**
 * The mobile-web layer itself.
 *
 * These are the assertions that make the suite a **mobile web** suite and
 * not a desktop suite that happens to run in a browser. They verify:
 *
 *  - the browser really is the mobile browser of the target device,
 *  - the layout really is the mobile layout,
 *  - the navigation really is an off-canvas drawer,
 *  - the page really responds to touch input.
 *
 * The device-specific expectations come from `config/devices.ts`, so the
 * same spec asserts the right thing on an iPhone and on a Galaxy.
 */
describeMobile(
    'Mobile web environment',
    { features: [featureTag('mobile_web')], tags: [Tags.UI, Tags.SMOKE, Tags.MOBILE, Tags.RESPONSIVE] },
    () => {
        let app: AppContainer;

        beforeEach(async () => {
            app = await useAuthenticatedApp();
        });

        itMobile(
            title(3601, 'runs in the mobile browser of the target device'),
            { features: [featureTag('mobile_web')], tags: [Tags.SMOKE, Tags.MOBILE] },
            async () => {
                const userAgent = await app.components.mobile.userAgent();

                expect(
                    userAgent,
                    'the user agent does not identify a mobile device',
                ).toMatch(/Mobi|Android|iPhone|iPad/i);
            },
        );

        itMobile(
            title(3602, 'reports a mobile-sized viewport'),
            { features: [featureTag('mobile_web')], tags: [Tags.SMOKE, Tags.RESPONSIVE] },
            async () => {
                const viewport = await app.components.mobile.viewport();

                // A desktop viewport on a phone-sized device would mean the
                // browser rendered the desktop layout — the very thing this
                // suite exists to catch.
                expect(
                    viewport.width,
                    `the viewport is ${viewport.width}px wide — the desktop layout was served`,
                ).toBeLessThan(768);
                expect(viewport.height).toBeGreaterThan(0);
            },
        );

        itMobile(
            title(3603, 'reports a device pixel ratio above one'),
            { features: [featureTag('mobile_web')], tags: [Tags.MOBILE] },
            async () => {
                const ratio = await app.components.mobile.devicePixelRatio();

                expect(ratio).toBeGreaterThan(1);
            },
        );

        itMobile(
            title(3604, 'renders the mobile layout of the app shell'),
            { features: [featureTag('mobile_web')], tags: [Tags.SMOKE, Tags.RESPONSIVE] },
            async () => {
                expect(await app.components.mobile.isMobileLayout()).toBe(true);
            },
        );

        itMobile(
            title(3605, 'exposes touch support to the page'),
            { features: [featureTag('mobile_web')], tags: [Tags.MOBILE] },
            async () => {
                expect(await app.components.mobile.hasTouchSupport()).toBe(true);
            },
        );

        itMobile(
            title(3606, 'keeps the navigation in an off-canvas drawer'),
            { features: [featureTag('mobile_navigation')], tags: [Tags.MOBILE, Tags.RESPONSIVE] },
            async () => {
                // The drawer starts closed: its panel lies outside the
                // viewport even though the element is "displayed".
                expect(await app.components.sidebar.isDrawerOpen()).toBe(false);

                await app.components.sidebar.openDrawer();
                expect(await app.components.sidebar.isDrawerOpen()).toBe(true);

                await app.components.sidebar.closeDrawer();
                expect(await app.components.sidebar.isDrawerOpen()).toBe(false);
            },
        );

        itMobile(
            title(3607, 'navigates to the orders list through the drawer'),
            { features: [featureTag('mobile_navigation')], tags: [Tags.SMOKE, Tags.MOBILE] },
            async () => {
                await app.components.sidebar.navigateTo('Orders');

                await browser.waitUntil(async () => (await browser.getUrl()).includes('#/orders'), {
                    timeout: 30_000,
                    timeoutMsg: 'The orders route did not open from the drawer.',
                    interval: 500,
                });

                expect(await browser.getUrl()).toMatch(/#\/orders/);
            },
        );

        itMobile(
            title(3608, 'renders the navigation groups on a phone screen'),
            { features: [featureTag('mobile_navigation')], tags: [Tags.MOBILE] },
            async () => {
                await app.components.sidebar.openDrawer();

                // The groups are accordions: the leaves are hidden until their
                // group is expanded. The suite therefore has to open a group
                // before it can reach a leaf.
                const failed = await collectFailures({
                    'the drawer is reachable': async () =>
                        expect(await app.components.sidebar.isDrawerOpen()).toBe(true),
                    'the core sections are in the navigation': async () => {
                        const hrefs = await app.components.sidebar.hrefs();
                        expect(hrefs.some((href) => href.includes('shipping-labels'))).toBe(true);
                        expect(hrefs.some((href) => href.includes('#/orders'))).toBe(true);
                        expect(hrefs.some((href) => href.includes('address-book'))).toBe(true);
                        expect(hrefs.some((href) => href.includes('#/setting/'))).toBe(true);
                    },
                });

                expectNoFailures(failed, 'Navigation checks failed');
            },
        );

        itMobile(
            title(3609, 'resizes the viewport without breaking the shell'),
            { features: [featureTag('mobile_web')], tags: [Tags.RESPONSIVE] },
            async () => {
                // The page must survive a viewport change — on a phone that
                // happens every time the keyboard opens or the device is
                // rotated.
                const before = await app.components.mobile.viewport();
                expect(before.width).toBeGreaterThan(0);

                await browser.setWindowSize(before.width, Math.max(before.height - 200, 200));

                const after = await app.components.mobile.viewport();
                expect(after.height).toBeLessThan(before.height);

                const content = await app.pages.dashboard.content();
                await expect(content).toBeDisplayed();
            },
        );

        itMobile(
            title(3610, 'uses the device viewport of the target profile'),
            { features: [featureTag('mobile_web')], tags: [Tags.MOBILE] },
            async () => {
                // The configured viewport is the reference; the browser may
                // differ by a few pixels because of the browser chrome, but
                // it must be in the same ballpark. The profile is chosen from
                // the *running* platform, so the same spec asserts the right
                // thing on an iPhone and on a Galaxy.
                const platform = String(
                    browser.capabilities.platformName ?? '',
                ).toLowerCase();
                const profile = platform.startsWith('ios') ? IOS_DEVICE : ANDROID_DEVICE;

                const viewport = await app.components.mobile.viewport();
                const expected = profile.viewport.width;

                expect(
                    Math.abs(viewport.width - expected),
                    `the viewport is ${viewport.width}px, the ${profile.deviceName} profile expects ~${expected}px`,
                ).toBeLessThanOrEqual(80);
            },
        );
    },
);
