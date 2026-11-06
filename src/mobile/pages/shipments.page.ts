import { browser } from '@wdio/globals';
import { BasePage } from './base.page';
import { SEARCH_INPUT, routeTableXPath } from '../selectors';
import { DatatableComponent } from '../components/datatable.component';

/**
 * Booked shipments (`#/shipping-labels`).
 *
 * The page renders a DataTables-style list backed by
 * `POST /api/v2/shipments/datatable`.
 *
 * Columns: `[checkbox] · ID · Name · Address · City · Country · Type ·
 * Created · Via · More`. Column 1 is the row-select checkbox, so the
 * shipment id is in **column 2**.
 *
 * Mobile adaptation
 * -----------------
 * The list is a wide table inside a horizontally scrollable region. The
 * column widths are squeezed on a phone, so the *values* are read from the
 * DOM rather than from their rendered position, and the table itself is
 * addressed through the route-scoped XPath (CSS `:has()` is not reliably
 * implemented by Appium's selector engines).
 */
export class ShipmentsPage extends BasePage {
    protected readonly path = '/main/app/#/shipping-labels';

    /**
     * The route's own datatable, with at least one row. Scoping the wait to
     * the route is what keeps it from matching the previous route's table,
     * which is still in the DOM until the new view is attached.
     */
    protected readonly readySelector = routeTableXPath('shipments');

    /** The list component of this route. */
    get table(): DatatableComponent {
        return new DatatableComponent('shipments');
    }

    /** The search/filter input above the list. */
    async searchInput() {
        return browser.$(SEARCH_INPUT);
    }

    /** The data-bearing table element. */
    async tableElement() {
        return browser.$(routeTableXPath('shipments'));
    }

    /**
     * The shipment ids visible in the current page of results.
     *
     * The id is the second rendered column (the first is the checkbox).
     */
    async visibleShipmentIds(): Promise<string[]> {
        return this.table.columnValues(1);
    }
}
