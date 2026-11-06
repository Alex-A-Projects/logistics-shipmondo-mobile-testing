import { browser } from '@wdio/globals';
import { describeMobile, itMobile, expect, Tags, featureTag, title } from '../../src/shared';
import { collectFailures, expectNoFailures } from '../../src/shared/assertions';
import { useAuthenticatedApp, useSignedOutApp, type AppContainer } from '../../src/mobile/fixtures';

/**
 * Authentication on a mobile browser.
 *
 * The scenario coverage mirrors the desktop suite (tickets 3001–3007): the
 * form renders, a valid sign-in reaches the dashboard, an invalid password
 * is rejected by the server, and the client-side validator blocks a
 * malformed address or a missing password.
 *
 * The mobile adaptation is in the *interaction*, not in the scenario: the
 * credentials are typed through `setValue` (one atomic assignment, so the
 * on-screen keyboard cannot swallow a character) and the submit button is
 * scrolled into view before it is tapped, because the software keyboard
 * covers the lower half of a phone screen.
 */
describeMobile('Login', { features: [featureTag('auth')], tags: [Tags.UI, Tags.SMOKE, Tags.AUTH] }, () => {
    let app: AppContainer;

    beforeEach(async () => {
        app = await useSignedOutApp();
    });

    itMobile(
        title(3001, 'shows the login form on the login page'),
        { features: [featureTag('auth')], tags: [Tags.SMOKE] },
        async () => {
            const email = await app.pages.login.emailInput();
            const password = await app.pages.login.passwordInput();
            const submit = await app.pages.login.submitButton();

            await expect(email).toBeDisplayed();
            await expect(password).toBeDisplayed();
            await expect(submit).toBeDisplayed();
        },
    );

    itMobile(
        title(3002, 'redirects to the dashboard after a successful login'),
        { features: [featureTag('auth')], tags: [Tags.SMOKE] },
        async () => {
            const email = process.env.SHIPMONDO_WEB_USER ?? '';
            const password = process.env.SHIPMONDO_WEB_PASSWORD ?? '';

            await app.pages.login.goto();
            await app.pages.login.login(email, password);

            await browser.waitUntil(async () => (await browser.getUrl()).includes('#/dashboard'), {
                timeout: 60_000,
                timeoutMsg: 'The sign-in did not reach the dashboard.',
                interval: 500,
            });

            expect(await browser.getUrl()).toContain('#/dashboard');
        },
    );

    itMobile(
        title(3003, 'shows the signed-in account in the mobile header'),
        { features: [featureTag('auth')], tags: [Tags.SMOKE] },
        async () => {
            const signedIn = await useAuthenticatedApp();

            // On a phone the header is condensed and the account name lives
            // behind the profile avatar — so the name is read through the
            // top bar, which opens the menu when needed.
            const name = await signedIn.components.topbar.accountName();

            expect(name, 'the signed-in account name is not shown anywhere in the header').toBeTruthy();
        },
    );

    itMobile(
        title(3004, 'keeps the user on the login page for an invalid password'),
        { features: [featureTag('auth')], tags: [Tags.NEGATIVE] },
        async () => {
            const email = process.env.SHIPMONDO_WEB_USER ?? '';

            await app.pages.login.goto();
            await app.pages.login.login(email, 'definitely-not-the-password');

            // A wrong password is the only case the SERVER rejects, so the
            // form really POSTs and the page re-renders with a danger alert.
            await browser.waitUntil(async () => {
                const error = await app.pages.login.errorMessage();
                return error.isExisting();
            }, {
                timeout: 30_000,
                timeoutMsg: 'The login form did not report the rejected password.',
                interval: 500,
            });

            expect(await app.pages.login.isOnLoginRoute()).toBe(true);

            const error = await app.pages.login.errorMessage();
            await expect(error).toBeDisplayed();
            expect((await app.pages.login.errorText()) ?? '').toMatch(/not valid/i);
        },
    );
});

describeMobile(
    'Login — form validation',
    { features: [featureTag('auth')], tags: [Tags.UI, Tags.NEGATIVE, Tags.AUTH] },
    () => {
        let app: AppContainer;

        beforeEach(async () => {
            app = await useSignedOutApp();
        });

        itMobile(
            title(3005, 'rejects a login with a malformed email address'),
            { features: [featureTag('auth')], tags: [Tags.NEGATIVE] },
            async () => {
                await app.pages.login.goto();
                await app.pages.login.login('not-an-email', 'some-password');

                // The malformed address is caught by the CLIENT-SIDE
                // validator, so no request reaches the server: the URL is
                // untouched and no danger alert is rendered — only the inline
                // field error.
                const emailError = await app.pages.login.emailError();
                await emailError.waitForDisplayed({
                    timeout: 15_000,
                    timeoutMsg: 'The inline e-mail error never appeared.',
                });

                expect(await app.pages.login.isOnLoginRoute()).toBe(true);
                expect(await emailError.getText()).toMatch(/correct e-mail/i);

                const alert = await app.pages.login.errorMessage();
                expect(await alert.isExisting(), 'a server error alert was rendered').toBe(false);
            },
        );

        itMobile(
            title(3006, 'requires the password field'),
            { features: [featureTag('auth')], tags: [Tags.NEGATIVE] },
            async () => {
                await app.pages.login.goto();
                const email = await app.pages.login.emailInput();
                await email.setValue('someone@example.test');
                await app.pages.login.submit();

                const passwordError = await app.pages.login.passwordError();
                await passwordError.waitForDisplayed({
                    timeout: 15_000,
                    timeoutMsg: 'The inline password error never appeared.',
                });

                expect(await passwordError.getText()).toMatch(/please fill in password/i);
                expect(await app.pages.login.isOnLoginRoute()).toBe(true);
            },
        );

        itMobile(
            title(3007, 'keeps the user on the login page when both fields are empty'),
            { features: [featureTag('auth')], tags: [Tags.NEGATIVE] },
            async () => {
                await app.pages.login.goto();
                await app.pages.login.submit();

                const failed = await collectFailures({
                    'e-mail error': async () => {
                        const error = await app.pages.login.emailError();
                        await error.waitForDisplayed({ timeout: 15_000 });
                    },
                    'password error': async () => {
                        const error = await app.pages.login.passwordError();
                        await error.waitForDisplayed({ timeout: 15_000 });
                    },
                });

                expectNoFailures(failed, 'Missing field errors');
                expect(await app.pages.login.isOnLoginRoute()).toBe(true);
            },
        );
    },
);
