import { browser } from '@wdio/globals';
import { BaseComponent, countOf } from './base.component';
import { EMPTY_CELL, routeTableXPath, SEARCH_INPUT, TABLE_INFO } from '../selectors';
import type { RouteKey } from '../selectors';

/**
 * The DataTables-style list component used across the Shipmondo app
 * (shipments, orders, drafts, address book, API access).
 *
 * Backed by a `POST .../datatable.json` endpoint that returns
 * `{ draw, recordsTotal, recordsFiltered, data: [...] }`.
 *
 * Every list renders **two** tables: a header-only clone used for the fixed
 * header and the scrolling body table that carries the rows. Only the body
 * table is addressed here, otherwise headers and rows would be counted twice.
 *
 * Mobile adaptation
 * -----------------
 * On a phone the list is rendered inside a horizontally scrollable region.
 * Reading every cell through the WebDriver protocol would be one round trip
 * per cell, so the row and header extraction is done in a single
 * `browser.execute` call that reads the DOM directly. What the test asserts
 * on is identical to what the desktop suite asserts on.
 */
export class DatatableComponent extends BaseComponent {
    /** The route this list belongs to. */
    constructor(private readonly route: RouteKey) {
        super();
    }

    /** The data-bearing table of the list. */
    protected get root() {
        return browser.$(routeTableXPath(this.route));
    }

    /** The visible search box above the list. */
    async searchInput() {
        return browser.$(SEARCH_INPUT);
    }

    /** Fills the search box. */
    async search(term: string): Promise<void> {
        const input = await this.searchInput();
        await input.setValue(term);
    }

    /** Header cell texts, in order, without the empty checkbox column. */
    async headers(): Promise<string[]> {
        return browser.execute((tableXPath: string) => {
            const table = document.evaluate(
                tableXPath,
                document,
                null,
                XPathResult.FIRST_ORDERED_NODE_TYPE,
                null,
            ).singleNodeValue as HTMLElement | null;
            if (!table) {
                return [];
            }
            return Array.from(table.querySelectorAll('thead th'))
                .map((cell) => (cell.textContent ?? '').trim())
                .filter((text) => text.length > 0);
        }, routeTableXPath(this.route));
    }

    /**
     * The rendered body rows as arrays of cell texts.
     *
     * The "no data available" row is excluded — it is rendered as a row but
     * it is not data.
     */
    async rows(): Promise<string[][]> {
        return browser.execute((tableXPath: string) => {
            const table = document.evaluate(
                tableXPath,
                document,
                null,
                XPathResult.FIRST_ORDERED_NODE_TYPE,
                null,
            ).singleNodeValue as HTMLElement | null;
            if (!table) {
                return [];
            }
            return Array.from(table.querySelectorAll('tbody tr'))
                .filter((row) => row.querySelector('td.dataTables_empty') === null)
                .map((row) =>
                    Array.from(row.querySelectorAll('td')).map((cell) =>
                        (cell.textContent ?? '').trim(),
                    ),
                );
        }, routeTableXPath(this.route));
    }

    /** The number of rendered body rows. */
    async rowCount(): Promise<number> {
        return (await this.rows()).length;
    }

    /**
     * The values of one column, zero-based.
     *
     * @param column zero-based column index (1 = the ID column of a list
     *               that starts with the row-select checkbox)
     */
    async columnValues(column: number): Promise<string[]> {
        const rows = await this.rows();
        return rows
            .map((cells) => cells[column] ?? '')
            .map((value) => value.trim())
            .filter((value) => value.length > 0);
    }

    /** The "no results" cell, present when the list is empty. */
    async emptyMessage() {
        return browser.$(EMPTY_CELL);
    }

    /** Whether the list reports that it is empty. */
    async isEmpty(): Promise<boolean> {
        return (await countOf(EMPTY_CELL)) > 0;
    }

    /**
     * Total record count reported by the server.
     *
     * The info line reads "Showing 1 to 25 of 68 entries"; the total is the
     * number after "of".
     */
    async totalRecords(): Promise<number | undefined> {
        const info = await browser.$(TABLE_INFO);
        if (!(await info.isExisting())) {
            return undefined;
        }
        const text = await info.getText();
        const match = text.match(/of\s+(\d+)/i);
        return match ? Number(match[1]) : undefined;
    }
}
