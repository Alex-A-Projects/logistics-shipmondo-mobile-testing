import { browser } from '@wdio/globals';
import { BasePage } from './base.page';
import { SEARCH_INPUT, routeTableXPath } from '../selectors';
import { DatatableComponent } from '../components/datatable.component';

/**
 * Sales orders (`#/orders`).
 *
 * Backed by `POST /api/v2/order_management/sales_orders/datatable.json`.
 *
 * Columns: `[checkbox] · Order No. · Name · Country · Amount incl. VAT ·
 * Ordered · Payment status · Fulfilled · Via`. Column 1 is the row-select
 * checkbox, so the order id is in **column 2**.
 *
 * The list supports filters encoded in the hash route, e.g.
 * `#/orders?filters=[{"field":"order_status","filter_value":"0","operator":"eq"}]`.
 */
export class OrdersPage extends BasePage {
    protected readonly path = '/main/app/#/orders';

    /**
     * The route's own datatable, with at least one row. Scoping the wait to
     * the route is what keeps it from matching the previous route's table.
     */
    protected readonly readySelector = routeTableXPath('orders');

    /** The list component of this route. */
    get table(): DatatableComponent {
        return new DatatableComponent('orders');
    }

    /** The search/filter input above the list. */
    async searchInput() {
        return browser.$(SEARCH_INPUT);
    }

    /** The data-bearing table element. */
    async tableElement() {
        return browser.$(routeTableXPath('orders'));
    }

    /**
     * The order ids visible in the current page of results.
     *
     * Column 2 holds the order number — the shop's own reference for the
     * order, not a label.
     */
    async visibleOrderIds(): Promise<string[]> {
        return this.table.columnValues(1);
    }
}
