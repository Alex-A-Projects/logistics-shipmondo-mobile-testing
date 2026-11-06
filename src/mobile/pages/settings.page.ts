import { browser } from '@wdio/globals';
import { BasePage } from './base.page';
import { routeTableXPath } from '../selectors';
import { DatatableComponent } from '../components/datatable.component';

/**
 * Settings → Integrations → API (`#/setting/api`).
 *
 * Shows the API access entries for the account. The API key itself is never
 * displayed after creation, so no secret can leak through this page object.
 *
 * Columns: `Name · Last used · Created · More` — there is no checkbox
 * column here, so the name is in **column 1**.
 *
 * Backed by `POST /api/v2/api_credentials/datatable.json`.
 */
export class SettingsPage extends BasePage {
    protected readonly path = '/main/app/#/setting/api';

    /**
     * The route's own datatable, with at least one row. Scoping the wait to
     * the route keeps it from matching the previous route's table.
     */
    protected readonly readySelector = routeTableXPath('apiAccess');

    /** The list component of this route. */
    get table(): DatatableComponent {
        return new DatatableComponent('apiAccess');
    }

    /** The data-bearing table element. */
    async apiAccessTable() {
        return browser.$(routeTableXPath('apiAccess'));
    }

    /** The names of the API access entries. */
    async apiAccessNames(): Promise<string[]> {
        return this.table.columnValues(0);
    }

    /**
     * The "Create API access" control.
     *
     * It is rendered as an anchor styled as a button
     * (`href="#/setting/api/new"`), not as a `<button>` — so it is matched
     * by its href rather than by its role.
     */
    async createAccessButton() {
        return browser.$('a[href*="/setting/api/new"]');
    }
}
