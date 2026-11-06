import { browser } from '@wdio/globals';
import type { Cookie } from '@wdio/protocols';
import { LoginPage } from '../pages/login.page';
import { TopbarComponent } from '../components/topbar.component';
import { env, MISSING_CREDENTIALS, timeouts } from '../../shared/env';

/**
 * Authentication against the Shipmondo **web** app, from a mobile browser.
 *
 * The service drives the real login form — the same form a user on a phone
 * would fill in — and can restore a previously captured session through the
 * browser's cookie jar.
 *
 * Why the session is restored rather than re-typed
 * -------------------------------------------------
 * The demo app is a remote Rails server: one sign-in costs seconds of
 * server time plus the time for the AngularJS shell to render on a mobile
 * connection. Signing in once per *test* would mean a sign-in per test on
 * every device. Instead the session is captured **once per worker** and the
 * cookies are replayed into the browser before each test.
 *
 * The cookies are held **in memory only**. They are never written to disk,
 * never exported to an artefact and never printed.
 */
export class AuthService {
    private readonly loginPage = new LoginPage();
    private readonly topbar = new TopbarComponent();

    /** True when credentials are configured. */
    get hasCredentials(): boolean {
        return Boolean(env.baseURL);
    }

    /**
     * Signs in through the login form and waits for the dashboard.
     *
     * @param email the account address
     * @param password the account password
     */
    async signIn(email: string, password: string): Promise<void> {
        if (!email || !password) {
            throw new Error(MISSING_CREDENTIALS);
        }

        await this.loginPage.goto();
        await this.loginPage.login(email, password);

        await browser.waitUntil(
            async () => (await browser.getUrl()).includes('#/dashboard'),
            {
                timeout: timeouts.pageLoad,
                timeoutMsg: 'The sign-in did not reach the dashboard within the timeout.',
                interval: 500,
            },
        );
    }

    /**
     * Signs in through the login form using the configured credentials.
     */
    async signInWithConfiguredCredentials(): Promise<void> {
        const email = process.env.SHIPMONDO_WEB_USER ?? '';
        const password = process.env.SHIPMONDO_WEB_PASSWORD ?? '';
        await this.signIn(email, password);
    }

    /** Signs out through the profile menu. */
    async signOut(): Promise<void> {
        await this.topbar.openProfileMenu();
        const signOut = await this.topbar.signOutLink();
        if (await signOut.isExisting()) {
            await signOut.click();
        }
    }

    /**
     * The session cookies of the current browser session.
     *
     * @returns the cookies, or an empty array when the browser exposes none
     */
    async captureSession(): Promise<Cookie[]> {
        const cookies = await browser.getCookies();
        return cookies;
    }

    /**
     * Replays a captured session into the browser.
     *
     * @param cookies the cookies captured by {@link captureSession}
     */
    async restoreSession(cookies: Cookie[]): Promise<void> {
        if (cookies.length === 0) {
            return;
        }
        await browser.setCookies(cookies);
    }

    /** Removes every cookie from the browser session. */
    async clearSession(): Promise<void> {
        await browser.deleteCookies();
    }
}
