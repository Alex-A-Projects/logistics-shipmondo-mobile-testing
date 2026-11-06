import { browser } from '@wdio/globals';
import { BasePage } from './base.page';
import { SEARCH_INPUT, routeTableXPath } from '../selectors';
import { DatatableComponent } from '../components/datatable.component';

/**
 * Address book (`#/address-book`) — regular receivers.
 *
 * Backed by `POST /api/v1/regular_receivers/datatable.json`.
 *
 * Columns: `[checkbox] · Name · Address · Address 2 · Country / City ·
 * E-mail · More`. Column 1 is the row-select checkbox, so the name is in
 * **column 2**.
 *
 * The demo tenant has **no saved addresses**: the list renders the
 * DataTables "No data available in table" row, and the same is true of the
 * backing endpoint. A test must therefore assert the rendered state rather
 * than assume rows exist.
 */
export class AddressBookPage extends BasePage {
    protected readonly path = '/main/app/#/address-book';

    /**
     * The route's own datatable. Scoping the wait to the route keeps it
     * from matching the previous route's table.
     */
    protected readonly readySelector = routeTableXPath('addressBook');

    /** The list component of this route. */
    get table(): DatatableComponent {
        return new DatatableComponent('addressBook');
    }

    /** The data-bearing table element. */
    async tableElement() {
        return browser.$(routeTableXPath('addressBook'));
    }

    /** The "no data available" cell, present when the list is empty. */
    async emptyMessage() {
        return browser.$(`${routeTableXPath('addressBook')}//td[contains(@class,"dataTables_empty")]`);
    }

    /** The search/filter input above the list. */
    async searchInput() {
        return browser.$(SEARCH_INPUT);
    }

    /**
     * The control that opens the "add address" form.
     *
     * On the desktop theme it is a button; the mobile theme renders it as an
     * anchor styled as a button. Both are matched by their label, because
     * the href differs between theme builds.
     */
    async addButton() {
        return browser.$(
            '//a[contains(translate(normalize-space(.), "ABCDEFGHIJKLMNOPQRSTUVWXYZ", "abcdefghijklmnopqrstuvwxyz"), "create address") or contains(@href, "address-book/new")]|//button[contains(translate(normalize-space(.), "ABCDEFGHIJKLMNOPQRSTUVWXYZ", "abcdefghijklmnopqrstuvwxyz"), "create address")]',
        );
    }

    /** The names listed in the address book. */
    async visibleNames(): Promise<string[]> {
        return this.table.columnValues(1);
    }
}
