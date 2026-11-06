import { browser } from '@wdio/globals';
import type { Cookie } from '@wdio/protocols';
import {
    createAppContainer,
    type AppComponents,
    type AppContainer,
    type AppPages,
    type AppServices,
} from './app-container';
import { AuthService } from '../services/auth.service';
import { env, MISSING_CREDENTIALS, timeouts } from '../../shared/env';

/**
 * The mobile-web test fixtures.
 *
 * WebdriverIO has no Playwright-style fixture arguments, so the fixtures are
 * **hooks** instead: a spec calls them from its own `beforeEach` and keeps
 * the returned container.
 *
 * ```ts
 * let app: AppContainer;
 *
 * beforeEach(async () => {
 *     app = await useAuthenticatedApp();
 * });
 * ```
 *
 * Two variants exist:
 *
 *  - {@link useAuthenticatedApp} — a signed-in session on the dashboard.
 *  - {@link useSignedOutApp}   — a fresh, signed-out session on the login
 *                                page (the login specs need the *absence* of
 *                                a session).
 *
 * The session is captured **once per worker** and replayed afterwards, so
 * the suite performs one real sign-in per device instead of one per test.
 * The cookies live in memory only.
 */

declare global {
    // eslint-disable-next-line @typescript-eslint/no-namespace
    namespace WebdriverIO {
        interface Browser {
            /** The application container of the running test. */
            app: AppContainer;
        }
    }
}

/** The cookies of the worker session, captured once and replayed per test. */
let workerSession: Cookie[] | undefined;

/** The account address used by the worker session. */
const sessionEmail = process.env.SHIPMONDO_WEB_USER ?? '';

/** The account password used by the worker session. */
const sessionPassword = process.env.SHIPMONDO_WEB_PASSWORD ?? '';

/**
 * Signs in (once per worker) and opens the dashboard.
 *
 * @returns the application container for the test
 */
export async function useAuthenticatedApp(): Promise<AppContainer> {
    if (!sessionEmail || !sessionPassword) {
        throw new Error(MISSING_CREDENTIALS);
    }

    const container = createAppContainer();
    const auth = new AuthService();

    if (workerSession && workerSession.length > 0) {
        // The worker already signed in; replay its session and go straight
        // to the dashboard. If the replay did not take, the sign-in below
        // runs again — the app redirects to the login page in that case.
        await auth.restoreSession(workerSession);
        await browser.url(`${env.appPath}/#/dashboard`);
        await browser.waitUntil(
            async () => !(await browser.getUrl()).includes('/account/login'),
            {
                timeout: timeouts.pageLoad,
                timeoutMsg: 'The restored session was rejected — the app is not signed in.',
                interval: 500,
            },
        );
    } else {
        await auth.signIn(sessionEmail, sessionPassword);
        workerSession = await auth.captureSession();
    }

    await waitForAppShell(container);
    browser.app = container;
    return container;
}

/**
 * Starts from a signed-out session on the login page.
 *
 * @returns the application container for the test
 */
export async function useSignedOutApp(): Promise<AppContainer> {
    const container = createAppContainer();
    const auth = new AuthService();

    await auth.clearSession();
    await container.pages.login.goto();
    await container.pages.login.waitForReady();

    browser.app = container;
    return container;
}

/**
 * Waits for the AngularJS shell to finish rendering.
 *
 * The URL flips to `#/dashboard` *before* the shell renders, so a wait that
 * keyed on the URL alone would hand the test an empty page. The wait keys
 * on the dashboard's own content instead.
 */
async function waitForAppShell(container: AppContainer): Promise<void> {
    const content = await container.pages.dashboard.content();
    await content.waitForDisplayed({
        timeout: timeouts.waitForDisplayed,
        timeoutMsg: 'The Shipmondo app shell did not render.',
    });
    await browser.waitUntil(async () => (await container.pages.dashboard.tileCount()) > 0, {
        timeout: timeouts.waitForDisplayed,
        timeoutMsg: 'The dashboard tiles did not render.',
        interval: 250,
    });
}

export { createAppContainer };
export type { AppContainer, AppPages, AppComponents, AppServices };
