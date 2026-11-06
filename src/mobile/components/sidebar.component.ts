import { browser } from '@wdio/globals';
import { BaseComponent } from './base.component';
import { NAVIGATION_BACKDROP, NAVIGATION_TOGGLES, SIDEBAR_GROUP, SIDEBAR_PANEL } from '../selectors';

/**
 * The app's left navigation sidebar — an **off-canvas drawer** on a phone.
 *
 * Structure (verified against the live demo app):
 *
 *   #left-panel > nav > ul
 *     └ li[data-menu-collapse]        ← a collapsible GROUP
 *         ├ a                         ← the group's toggle (href="#")
 *         └ ul
 *             ├ li > a[href="#/route"] ← a LEAF link
 *             └ li[data-menu-collapse] ← a nested group
 *
 * Two behaviours the component has to respect:
 *
 *  - **Leaves are invisible until their group is expanded.** The group `<ul>`
 *    carries `display: none` while collapsed, so a leaf cannot be tapped
 *    before its group is opened. A leaf may sit several groups deep.
 *  - **Groups behave like an accordion.** Opening one group collapses the
 *    others, so groups must be expanded outermost-first.
 *
 * The mobile adaptation
 * ---------------------
 * On a phone the panel is parked off-screen and only becomes reachable after
 * the hamburger has been tapped. `isDisplayed()` reports *true* for an
 * off-canvas element (it still has a box, it is merely translated out of the
 * viewport), so this component decides "is the drawer reachable?" from the
 * element's viewport rectangle instead — that is the only signal that
 * distinguishes "hidden in the drawer" from "hidden by CSS".
 */
export class SidebarComponent extends BaseComponent {
    protected get root() {
        return browser.$(SIDEBAR_PANEL);
    }

    /** All navigation links in the sidebar, expanded or not. */
    async links() {
        return browser.$$(`${SIDEBAR_PANEL} a`);
    }

    /** The collapsible groups. */
    async groups() {
        return browser.$$(SIDEBAR_GROUP);
    }

    /** A leaf navigation link by its `title` attribute. */
    async linkByTitle(title: string) {
        return browser.$(`${SIDEBAR_PANEL} a[title="${title}"]`);
    }

    /**
     * Every href the sidebar exposes.
     *
     * Read in one `execute` call: on a mobile browser a per-element round
     * trip is expensive, and the list is short.
     */
    async hrefs(): Promise<string[]> {
        return browser.execute((panel: string) => {
            const root = document.querySelector(panel);
            if (!root) {
                return [];
            }
            return Array.from(root.querySelectorAll('a')).map((a) => a.getAttribute('href') ?? '');
        }, SIDEBAR_PANEL);
    }

    /**
     * True when the drawer is reachable on screen.
     *
     * The panel is considered reachable when its left edge lies inside the
     * viewport. A closed drawer sits at a negative offset, so the check
     * distinguishes it from an open one even though both are "displayed".
     */
    async isDrawerOpen(): Promise<boolean> {
        return browser.execute((panel: string) => {
            const root = document.querySelector(panel);
            if (!root) {
                return false;
            }
            const rect = root.getBoundingClientRect();
            return rect.width > 0 && rect.left >= 0 && rect.left < window.innerWidth;
        }, SIDEBAR_PANEL);
    }

    /**
     * Opens the navigation drawer.
     *
     * The hamburger is looked up among a small set of candidate selectors
     * rather than one hard-coded id, so a slightly different theme build
     * does not break the whole suite. The drawer state is confirmed through
     * its viewport rectangle, not through a sleep.
     */
    async openDrawer(): Promise<void> {
        if (await this.isDrawerOpen()) {
            return;
        }

        const toggle = await this.findToggle();
        if (!toggle) {
            throw new Error(
                'No navigation toggle found. Tried: ' + NAVIGATION_TOGGLES.join(', ') +
                '. The sidebar cannot be reached on this viewport.',
            );
        }

        await toggle.click();

        await browser.waitUntil(
            async () => this.isDrawerOpen(),
            {
                timeout: 10_000,
                timeoutMsg: 'The navigation drawer did not open after tapping the toggle.',
                interval: 200,
            },
        );
    }

    /** Closes the navigation drawer by tapping the backdrop. */
    async closeDrawer(): Promise<void> {
        if (!(await this.isDrawerOpen())) {
            return;
        }
        const backdrop = await browser.$(NAVIGATION_BACKDROP);
        if (await backdrop.isExisting()) {
            await backdrop.click();
            await browser.waitUntil(
                async () => !(await this.isDrawerOpen()),
                {
                    timeout: 10_000,
                    timeoutMsg: 'The navigation drawer did not close after tapping the backdrop.',
                    interval: 200,
                },
            );
            return;
        }
        await this.openDrawerToggleOnly();
    }

    /** Taps the hamburger without asserting the resulting state. */
    private async openDrawerToggleOnly(): Promise<void> {
        const toggle = await this.findToggle();
        if (toggle) {
            await toggle.click();
        }
    }

    /** The first navigation toggle that exists in the DOM. */
    private async findToggle() {
        for (const selector of NAVIGATION_TOGGLES) {
            const element = await browser.$(selector);
            if (await element.isExisting()) {
                return element;
            }
        }
        return undefined;
    }

    /**
     * Expands every collapsed group between the sidebar root and the given
     * leaf link, outermost first.
     *
     * @param title the leaf link's `title` attribute
     */
    async expandGroupFor(title: string): Promise<void> {
        const link = await this.linkByTitle(title);
        if (!(await link.isExisting())) {
            throw new Error(`No sidebar link with title "${title}" exists in the DOM.`);
        }

        // The ancestor axis yields the *nearest* ancestor first; it is
        // reversed so the outermost group is expanded first — a nested
        // group's toggle is not tappable until its parent is open.
        const ancestors = await link.$$('xpath=ancestor::li[@data-menu-collapse]');
        const groupCount = await ancestors.length;
        for (let index = groupCount - 1; index >= 0; index--) {
            const group = ancestors[index];
            const sublist = await group.$('xpath=./ul[1]');
            if (!(await sublist.isExisting())) {
                continue;
            }
            if (await sublist.isDisplayed()) {
                continue;
            }
            const toggle = await group.$('xpath=./a[1]');
            if (await toggle.isExisting()) {
                await toggle.click();
            }
        }
    }

    /**
     * Taps a navigation link by its `title` attribute, opening the drawer
     * and expanding the owning group(s) first when needed.
     *
     * @param title the leaf link's `title` attribute (e.g. "Address book")
     */
    async navigateTo(title: string): Promise<void> {
        await this.openDrawer();
        await this.expandGroupFor(title);
        const link = await this.linkByTitle(title);
        await link.click();
    }
}
