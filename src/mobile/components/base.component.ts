import { browser, $, $$ } from '@wdio/globals';
import type { ChainablePromiseElement, ChainablePromiseArray } from 'webdriverio';
import { timeouts } from '../../shared/env';

/**
 * Base component.
 *
 * A component is a **reusable region of the app shell** — the sidebar, the
 * top bar, the datatable — as opposed to a page, which is a *route*.
 *
 * Two rules hold for every component in this framework:
 *
 *  1. **Zero assertions.** A component exposes state and performs actions;
 *     it never decides whether the state is correct. Verification belongs in
 *     the spec, which is what keeps the failure messages meaningful.
 *  2. **No fixed sleeps.** Every wait is anchored on a condition that the
 *     app itself controls (an element becoming visible, a class appearing).
 */
export abstract class BaseComponent {
    /** The component's root element. */
    protected abstract get root(): ChainablePromiseElement;

    /** Waits until the component's root is present in the DOM. */
    async waitForExist(timeout = timeouts.waitForDisplayed): Promise<void> {
        await this.root.waitForExist({ timeout });
    }

    /** Waits until the component's root is rendered and visible. */
    async waitForDisplayed(timeout = timeouts.waitForDisplayed): Promise<void> {
        await this.root.waitForDisplayed({ timeout });
    }

    /** True when the component's root exists in the DOM. */
    async exists(): Promise<boolean> {
        return this.root.isExisting();
    }

    /** True when the component's root is rendered and visible. */
    async isDisplayed(): Promise<boolean> {
        return this.root.isDisplayed();
    }

    /**
     * The trimmed text of the component's root.
     *
     * @returns the text, or `undefined` when the component is not rendered
     */
    async text(): Promise<string | undefined> {
        const root = await this.root;
        if (!(await root.isExisting())) {
            return undefined;
        }
        const value = (await root.getText()).trim();
        return value.length > 0 ? value : undefined;
    }

    /**
     * Reads the trimmed text of every element matched by a selector.
     *
     * The search is scoped to the component's own root — a component never
     * reaches into the rest of the page.
     *
     * @param selector a CSS or XPath selector
     */
    protected async textsOf(selector: string): Promise<string[]> {
        const root = await this.root;
        const elements = await root.$$(selector);
        const texts: string[] = [];
        for (const element of elements) {
            const value = (await element.getText()).trim();
            if (value.length > 0) {
                texts.push(value);
            }
        }
        return texts;
    }
}

/**
 * Convenience wrappers around the global `$` / `$$` helpers.
 *
 * They exist so that the components read declaratively (`await clickOn(...)`)
 * instead of repeating the WDIO import in every file.
 */

/** Finds a single element. */
export async function find(selector: string): Promise<ChainablePromiseElement> {
    return $(selector);
}

/** Finds all matching elements. */
export async function findAll(selector: string): Promise<ChainablePromiseArray> {
    return $$(selector);
}

/**
 * The number of elements a selector matches.
 *
 * `browser.$$` resolves to the *enhanced* element list; its `length` is typed
 * as a promise by WebdriverIO, so the list is resolved through
 * `getElements()` and counted as the plain array it is at runtime.
 *
 * @param selector a CSS or XPath selector
 */
export async function countOf(selector: string): Promise<number> {
    const elements = await (await browser.$$(selector)).getElements();
    return elements.length;
}

/** Waits until a condition holds, polling until the timeout expires. */
export async function waitUntil(
    condition: () => boolean | Promise<boolean>,
    timeout = timeouts.waitForDisplayed,
    description = 'condition',
): Promise<void> {
    await browser.waitUntil(condition, {
        timeout,
        timeoutMsg: `Timed out after ${timeout}ms waiting for ${description}.`,
        interval: 250,
    });
}
