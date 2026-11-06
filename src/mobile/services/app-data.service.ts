import { browser } from '@wdio/globals';
import type {
    AccountRecord,
    ApiCredentialRow,
    DatatableEnvelope,
    RegularReceiverRow,
    SalesOrderRow,
    ShipmentRow,
} from '../models/app-data.model';

/**
 * Service for the web app's own internal JSON API (`/api/v1/*`, `/api/v2/*`).
 *
 * These endpoints back the datatables the UI renders. Reading them lets a
 * mobile-web test cross-check what the app shows against what the app
 * fetched — without scraping the DOM for data values.
 *
 * How the requests are made
 * -------------------------
 * The requests are issued **from inside the mobile browser** with
 * `browser.executeAsync`. That is the mobile-web analogue of the desktop
 * suite's `context.request`:
 *
 *  - the browser's own session cookie is sent automatically,
 *  - the request is same-origin, so the `Origin`/`Referer` check passes,
 *  - the `X-Requested-With: XMLHttpRequest` header the app's own XHRs carry
 *    is set explicitly.
 *
 * Two request requirements, both verified against the live demo app:
 *
 *  1. **DataTables query envelope.** A request without `filters` and
 *     `order[0]` is rejected with HTTP 500, so {@link datatableBody} always
 *     sends the full envelope.
 *  2. **Same-origin headers.** Without `X-Requested-With: XMLHttpRequest` the
 *     endpoints answer `403 { "error": "Origin not allowed" }` — this is the
 *     app's CSRF origin check, not a permissions problem.
 *
 * Zero assertions — the service returns data, the spec decides.
 */
export class AppDataService {
    /**
     * The DataTables query envelope the app's own endpoints require.
     *
     * @param extra additional parameters (e.g. `filters` for a filtered view)
     */
    private datatableBody(extra: Record<string, string> = {}): string {
        const params = new URLSearchParams({
            draw: '1',
            start: '0',
            length: '25',
            'search[regex]': 'false',
            filters: '[]',
            'columns[0][data]': 'id',
            'columns[0][name]': 'id',
            'columns[0][searchable]': 'true',
            'columns[0][orderable]': 'true',
            'columns[0][search][regex]': 'false',
            'order[0][column]': '0',
            'order[0][dir]': 'asc',
            ...extra,
        });
        return params.toString();
    }

    /**
     * POSTs a datatable query from inside the browser and returns the parsed
     * envelope.
     *
     * @param path the endpoint path, e.g. `/v2/shipments/datatable`
     */
    async queryDatatable<T>(
        path: string,
        extra: Record<string, string> = {},
    ): Promise<DatatableEnvelope<T>> {
        const body = this.datatableBody(extra);
        const result = await this.postJson(`/api${path}`, body);

        if (result.status !== 200) {
            throw new Error(
                `App datatable request POST /api${path} failed with HTTP ${result.status}.`,
            );
        }
        try {
            return JSON.parse(result.body) as DatatableEnvelope<T>;
        } catch {
            throw new Error(`App datatable request POST /api${path} returned a non-JSON body.`);
        }
    }

    /** Rows from a datatable endpoint, e.g. `/v2/shipments/datatable`. */
    async shipmentRows(): Promise<ShipmentRow[]> {
        const body = await this.queryDatatable<ShipmentRow>('/v2/shipments/datatable');
        return body.data ?? [];
    }

    /** Rows from the sales orders datatable endpoint. */
    async salesOrderRows(): Promise<SalesOrderRow[]> {
        const body = await this.queryDatatable<SalesOrderRow>(
            '/v2/order_management/sales_orders/datatable.json',
        );
        return body.data ?? [];
    }

    /** Rows from the address book (regular receivers) datatable endpoint. */
    async addressBookRows(): Promise<RegularReceiverRow[]> {
        const body = await this.queryDatatable<RegularReceiverRow>(
            '/v1/regular_receivers/datatable.json',
        );
        return body.data ?? [];
    }

    /**
     * Rows from the API-access credentials datatable endpoint.
     *
     * The rows carry the entry's metadata only — never the API key.
     */
    async apiAccessRows(): Promise<ApiCredentialRow[]> {
        const body = await this.queryDatatable<ApiCredentialRow>(
            '/v2/api_credentials/datatable.json',
        );
        return body.data ?? [];
    }

    /** The account record for the signed-in user. */
    async account(): Promise<AccountRecord> {
        const result = await this.getJson('/api/v1/account.json');
        if (result.status !== 200) {
            throw new Error(`Account request failed with HTTP ${result.status}.`);
        }
        try {
            return JSON.parse(result.body) as AccountRecord;
        } catch {
            throw new Error('The account request returned a non-JSON body.');
        }
    }

    /**
     * Performs a POST from inside the browser and returns the raw response.
     *
     * `executeAsync` is used because the response arrives asynchronously;
     * Appium's `execute` is synchronous and would hand back a pending
     * promise instead of the payload.
     */
    private async postJson(path: string, body: string): Promise<{ status: number; body: string }> {
        return browser.executeAsync(
            (url: string, payload: string, done: (result: { status: number; body: string }) => void) => {
                const xhr = new XMLHttpRequest();
                xhr.open('POST', url, true);
                xhr.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded; charset=UTF-8');
                xhr.setRequestHeader('X-Requested-With', 'XMLHttpRequest');
                xhr.setRequestHeader('Accept', 'application/json, text/javascript, */*; q=0.01');
                xhr.withCredentials = true;
                xhr.onload = () => done({ status: xhr.status, body: xhr.responseText });
                xhr.onerror = () => done({ status: 0, body: '' });
                xhr.send(payload);
            },
            path,
            body,
        );
    }

    /** Performs a GET from inside the browser and returns the raw response. */
    private async getJson(path: string): Promise<{ status: number; body: string }> {
        return browser.executeAsync(
            (url: string, done: (result: { status: number; body: string }) => void) => {
                const xhr = new XMLHttpRequest();
                xhr.open('GET', url, true);
                xhr.setRequestHeader('X-Requested-With', 'XMLHttpRequest');
                xhr.setRequestHeader('Accept', 'application/json, text/javascript, */*; q=0.01');
                xhr.withCredentials = true;
                xhr.onload = () => done({ status: xhr.status, body: xhr.responseText });
                xhr.onerror = () => done({ status: 0, body: '' });
                xhr.send();
            },
            path,
        );
    }
}
