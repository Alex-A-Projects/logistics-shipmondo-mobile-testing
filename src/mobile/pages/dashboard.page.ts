import { browser } from '@wdio/globals';
import { BasePage } from './base.page';
import { countOf } from '../components/base.component';
import { CONTENT, routeContent } from '../selectors';

/**
 * The Shipmondo dashboard (`#/dashboard`).
 *
 * The app loads several JSON endpoints on entry (status_overview,
 * resource_counts_overview, activity_chart) and renders a set of counter
 * cards ("wells"), each headed by an `<h3>`:
 *
 *   Focus · Status · Activity · Product news · Latest blog posts
 *
 * The Focus card holds the shortcut links to the main sections — "Open
 * orders", "Orders on hold", "Drafts", "Shipments with issues" — each with a
 * badge count appended to the label.
 *
 * Mobile adaptation
 * -----------------
 * The cards are stacked in a single column on a phone, so they are read
 * through the DOM rather than through their on-screen position: a card that
 * is scrolled out of view is still part of the dashboard.
 */
export class DashboardPage extends BasePage {
    protected readonly path = '/main/app/#/dashboard';

    /** The "Focus" card is the first thing the dashboard renders. */
    protected readonly readySelector = `${routeContent('dashboard')} .well h3`;

    /** The main content region of the app shell. */
    async content() {
        return browser.$(CONTENT);
    }

    /** The counter cards rendered on the dashboard. */
    async tiles() {
        return browser.$$(`${CONTENT} .well`);
    }

    /**
     * The number of counter cards rendered on the dashboard.
     *
     * Read through the DOM rather than through the element list, so the count
     * can be polled while the shell is still rendering.
     */
    async tileCount(): Promise<number> {
        return countOf(`${CONTENT} .well`);
    }

    /**
     * The href of a dashboard shortcut link, found by its label.
     *
     * The label carries a badge count ("Open orders 31"), so the match is a
     * prefix and is performed in the DOM.
     *
     * @returns the href, or `undefined` when no shortcut carries the label
     */
    async shortcutHref(label: string): Promise<string | undefined> {
        return browser.execute(
            (selector: string, wanted: string) => {
                const links = Array.from(document.querySelectorAll(`${selector} a`));
                const match = links.find((link) =>
                    (link.textContent ?? '')
                        .trim()
                        .toLowerCase()
                        .startsWith(wanted.toLowerCase()),
                );
                return match?.getAttribute('href') ?? undefined;
            },
            CONTENT,
            label,
        );
    }

    /**
     * True when a dashboard shortcut with the given label is rendered.
     *
     * @param label the shortcut label, e.g. "Open orders"
     */
    async hasShortcut(label: string): Promise<boolean> {
        return (await this.shortcutHref(label)) !== undefined;
    }

    /**
     * Taps a dashboard shortcut link by its label.
     *
     * @param label the shortcut label, e.g. "Open orders"
     */
    async openShortcut(label: string): Promise<void> {
        const href = await this.shortcutHref(label);
        if (href === undefined) {
            throw new Error(`No dashboard shortcut labelled "${label}" was rendered.`);
        }
        await browser.execute((wanted: string) => {
            const links = Array.from(document.querySelectorAll('#content a'));
            const match = links.find(
                (link) =>
                    (link.textContent ?? '')
                        .trim()
                        .toLowerCase()
                        .startsWith(wanted.toLowerCase()),
            );
            match?.scrollIntoView({ block: 'center' });
            (match as HTMLElement | undefined)?.click();
        }, label);
    }

    /** The visible card headings — used to assert the dashboard contents. */
    async visibleSectionNames(): Promise<string[]> {
        return browser.execute((selector: string) => {
            return Array.from(document.querySelectorAll(`${selector} .well h3`))
                .map((heading) => (heading.textContent ?? '').trim())
                .filter((text) => text.length > 0);
        }, CONTENT);
    }
}
