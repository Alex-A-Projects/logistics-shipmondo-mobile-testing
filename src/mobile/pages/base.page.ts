import { browser } from '@wdio/globals';
import { timeouts } from '../../shared/env';

/**
 * Base Page Object for the mobile-web suite.
 *
 * Contains only navigation and locator helpers — **zero assertions** beyond
 * the readiness wait, which is a precondition of the page being usable
 * rather than a verification of business behaviour.
 *
 * The app is a hash-routed AngularJS SPA under `/main/app/`. Navigating
 * between two app routes is therefore a same-document navigation: the
 * session cookie survives and no shell reload happens — which matters a lot
 * on a mobile browser over a slow connection.
 */
export abstract class BasePage {
    /** The route path, relative to the base URL. */
    protected abstract readonly path: string;

    /**
     * Selector for the element that signals the page has finished loading.
     *
     * Must be **specific to this route**: the app swaps the content region
     * in place, so a generic selector such as `#content` would match the
     * *previous* route's content and make the wait a no-op.
     */
    protected abstract readonly readySelector: string;

    /** True for the SPA's fragment-routed pages. */
    protected get isHashRoute(): boolean {
        return this.path.includes('#');
    }

    /** The route fragment this page lives at, e.g. `#/orders`. */
    protected get hash(): string {
        const index = this.path.indexOf('#');
        return index === -1 ? '' : this.path.slice(index);
    }

    /**
     * Navigates to the page's route.
     *
     * When the browser is already on the target route the navigation is
     * skipped: re-issuing it would be a no-op at the URL level but a *full
     * reload* of the shell in practice, and a reloaded list route does not
     * always repaint its table.
     */
    async goto(): Promise<void> {
        if (this.isHashRoute && (await this.isCurrentRoute())) {
            return;
        }
        await browser.url(this.path);
    }

    /** Navigates and waits until the page is ready to interact with. */
    async gotoAndWait(): Promise<void> {
        await this.goto();
        await this.waitForReady();
    }

    /** Waits for the page's ready signal. Never a fixed sleep. */
    async waitForReady(): Promise<void> {
        const element = await browser.$(this.readySelector);
        await element.waitForDisplayed({
            timeout: timeouts.waitForDisplayed,
            timeoutMsg: `The page did not become ready (${this.readySelector} never appeared).`,
        });
    }

    /**
     * True when the browser is currently on this page's route.
     *
     * `browser.getUrl()` is a protocol call, so the check is asynchronous.
     */
    async isCurrentRoute(): Promise<boolean> {
        const url = await browser.getUrl();
        return this.hash.length > 0 ? url.includes(this.hash) : url.includes(this.path);
    }

    /** The current URL of the browser. */
    async currentUrl(): Promise<string> {
        return browser.getUrl();
    }

    /** Title of the browser tab — Shipmondo sets this per route. */
    async getTitle(): Promise<string> {
        return browser.getTitle();
    }
}
