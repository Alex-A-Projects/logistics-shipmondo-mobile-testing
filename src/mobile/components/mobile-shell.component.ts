import { browser } from '@wdio/globals';
import { BaseComponent } from './base.component';

/**
 * The mobile *browser* itself — the thing that makes this suite mobile-web
 * rather than desktop-web.
 *
 * The component answers three questions about the environment the app is
 * running in:
 *
 *  1. **Which browser is this?** — by user agent, which is what the
 *     "real mobile web" assertions check.
 *  2. **How big is the viewport?** — the CSS pixel size of the visible
 *     area, which is what a responsive layout reacts to.
 *  3. **Can the page be scrolled / tapped?** — the touch affordances the
 *     desktop suite does not have.
 *
 * Nothing here is asserted by the component itself; the specs do that.
 */
export class MobileShellComponent extends BaseComponent {
    protected get root() {
        return browser.$('body');
    }

    /** The browser's user-agent string. */
    async userAgent(): Promise<string> {
        return browser.execute(() => navigator.userAgent);
    }

    /** The CSS viewport size in pixels. */
    async viewport(): Promise<{ width: number; height: number }> {
        return browser.execute(() => ({
            width: window.innerWidth,
            height: window.innerHeight,
        }));
    }

    /** The device pixel ratio (a real phone reports more than 1). */
    async devicePixelRatio(): Promise<number> {
        return browser.execute(() => window.devicePixelRatio);
    }

    /** True when the browser reports a touch-capable environment. */
    async hasTouchSupport(): Promise<boolean> {
        return browser.execute(
            () => 'ontouchstart' in window || navigator.maxTouchPoints > 0,
        );
    }

    /** True when the page can be scrolled vertically. */
    async isScrollable(): Promise<boolean> {
        return browser.execute(
            () => document.documentElement.scrollHeight > window.innerHeight,
        );
    }

    /** True when the layout switched to the mobile breakpoint. */
    async isMobileLayout(): Promise<boolean> {
        return browser.execute(() => {
            const body = document.body;
            return (
                body.classList.contains('mobile-view-activated') ||
                window.innerWidth < 768
            );
        });
    }

    /**
     * Performs a real touch tap on the centre of an element.
     *
     * The WebDriver `click` already dispatches a native tap on mobile
     * browsers, so this is used only where the suite explicitly wants to
     * prove that touch input works.
     */
    async tap(selector: string): Promise<void> {
        const element = await browser.$(selector);
        await element.waitForDisplayed({ timeout: 10_000 });
        await element.click();
    }
}
