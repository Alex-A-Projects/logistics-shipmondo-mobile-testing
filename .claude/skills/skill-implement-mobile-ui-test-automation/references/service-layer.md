# The service layer — flows and the internal API

## Table of contents

1. [What belongs here](#what-belongs-here)
2. [`AuthService`](#authservice)
3. [`AppDataService`](#appdataservice)
4. [The models](#the-models)
5. [Anti-patterns](#anti-patterns)

---

## What belongs here

A service performs an **operation**: a flow with several steps, or a data access that is not a DOM lookup. Two exist in this repository.

| Service | Job |
|---|---|
| `AuthService` | Signs in through the real login form; captures, replays and clears the browser session. |
| `AppDataService` | Reads the Shipmondo web app's **own internal JSON API** from inside the mobile browser, so a test can cross-check what the app renders against what the app fetched. |

The rules:

- **Zero assertions.** The service returns data; the spec decides.
- **Never a thin wrapper around UI clicks.** A "service" that only clicks is a page-object method.
- **The API is read from inside the browser**, never from outside it. That is what makes this a mobile-web suite rather than an API suite: the request is same-origin, the session cookie is sent automatically, and the app's own CSRF origin check passes.

---

## `AuthService`

```ts
export class AuthService {
    private readonly loginPage = new LoginPage();
    private readonly topbar = new TopbarComponent();

    get hasCredentials(): boolean
    async signIn(email: string, password: string): Promise<void>
    async signInWithConfiguredCredentials(): Promise<void>
    async signOut(): Promise<void>
    async captureSession(): Promise<Cookie[]>
    async restoreSession(cookies: Cookie[]): Promise<void>
    async clearSession(): Promise<void>
}
```

### `signIn`

Drives the real form and waits for the dashboard:

```ts
async signIn(email: string, password: string): Promise<void> {
    if (!email || !password) {
        throw new Error(MISSING_CREDENTIALS);
    }

    await this.loginPage.goto();
    await this.loginPage.login(email, password);

    await browser.waitUntil(
        async () => (await browser.getUrl()).includes('#/dashboard'),
        {
            timeout: timeouts.pageLoad,
            timeoutMsg: 'The sign-in did not reach the dashboard within the timeout.',
            interval: 500,
        },
    );
}
```

`LoginPage.login()` does **not** wait for the resulting navigation. The demo server can take several seconds to answer, and blocking on the navigation burns the whole test budget on a single login; the caller waits for the outcome it expects instead.

### `signInWithConfiguredCredentials`

```ts
async signInWithConfiguredCredentials(): Promise<void> {
    const email = process.env.SHIPMONDO_WEB_USER ?? '';
    const password = process.env.SHIPMONDO_WEB_PASSWORD ?? '';
    await this.signIn(email, password);
}
```

The credentials come from the environment and are never logged.

### `signOut`

```ts
async signOut(): Promise<void> {
    await this.topbar.openProfileMenu();
    const signOut = await this.topbar.signOutLink();
    if (await signOut.isExisting()) {
        await signOut.click();
    }
}
```

Note `openProfileMenu()`: on a phone the account menu lives behind the profile avatar, so signing out is a two-step interaction — open the avatar menu, then tap "Sign out".

### The session methods

```ts
async captureSession(): Promise<Cookie[]> {
    const cookies = await browser.getCookies();
    return cookies;
}

async restoreSession(cookies: Cookie[]): Promise<void> {
    if (cookies.length === 0) {
        return;
    }
    await browser.setCookies(cookies);
}

async clearSession(): Promise<void> {
    await browser.deleteCookies();
}
```

The cookies are held **in memory only**. They are never written to disk, never exported to an artefact and never printed. `restoreSession()` is a no-op on an empty array rather than an error, because an empty cookie jar is a legitimate state for a signed-out browser.

---

## `AppDataService`

The Shipmondo web app fills its datatables from its own JSON endpoints (`/api/v1/*`, `/api/v2/*`). Reading them lets a mobile-web test compare the rendered list with the data the list was filled from — without scraping values out of the DOM.

### How the requests are made

From **inside** the mobile browser, with `browser.executeAsync`:

```ts
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
```

`executeAsync` rather than `execute`, because the response arrives asynchronously and Appium's synchronous `execute` would hand back a pending promise instead of the payload.

Three requirements, all verified against the live demo app:

1. **The session cookie travels automatically.** The request is issued by the page, so the browser's own cookie jar is used.
2. **The request must be same-origin.** It is, because it is issued by a page already on the tenant's domain.
3. **`X-Requested-With: XMLHttpRequest` must be set.** Without it the endpoints answer `403 { "error": "Origin not allowed" }` — that is the app's CSRF origin check, not a permissions problem.

### The DataTables query envelope

A datatable request without `filters` and `order[0]` is rejected with HTTP 500, so the full envelope is always sent:

```ts
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
```

### The public surface

```ts
async queryDatatable<T>(path: string, extra: Record<string, string> = {}): Promise<DatatableEnvelope<T>>
async shipmentRows(): Promise<ShipmentRow[]>
async salesOrderRows(): Promise<SalesOrderRow[]>
async addressBookRows(): Promise<RegularReceiverRow[]>
async apiAccessRows(): Promise<ApiCredentialRow[]>
async account(): Promise<AccountRecord>
```

The endpoint paths:

| Method | Endpoint |
|---|---|
| `shipmentRows()` | `POST /api/v2/shipments/datatable` |
| `salesOrderRows()` | `POST /api/v2/order_management/sales_orders/datatable.json` |
| `addressBookRows()` | `POST /api/v1/regular_receivers/datatable.json` |
| `apiAccessRows()` | `POST /api/v2/api_credentials/datatable.json` |
| `account()` | `GET /api/v1/account.json` |

`queryDatatable()` throws when the status is not 200 or when the body is not JSON — the service reports a broken request loudly rather than handing an empty array to the spec.

### How a spec uses it

The address-book case is the clearest illustration — it compares the rendered list with the backing endpoint rather than assuming that rows exist:

```ts
const apiRows = await app.services.appData.addressBookRows();
const renderedNames = await app.pages.addressBook.visibleNames();

expect(
    renderedNames.length,
    'the rendered list and the API disagree on the row count',
).toBe(apiRows.length);
```

And the API-access case compares the names directly:

```ts
const rendered = await app.pages.settings.apiAccessNames();
const rows = await app.services.appData.apiAccessRows();

expect(rendered).toEqual(rows.map((row) => row.name));
```

---

## The models

`src/mobile/models/app-data.model.ts` holds the shapes of the internal API responses.

```ts
export interface DatatableEnvelope<T> {
    draw: number;
    recordsTotal: number;
    recordsFiltered: number;
    filters?: unknown;
    invalid_filter_selections?: unknown;
    data: T[];
}
```

`ShipmentRow`, `SalesOrderRow` and `ApiCredentialRow` declare only the fields the suite actually relies on — a field the suite does not assert on is a field that should not be able to break a test.

Two deliberate choices:

- **`RegularReceiverRow` is `Record<string, unknown>`.** The demo tenant has no saved addresses, so the row shape could not be read from a live response. It is left untyped rather than invented; a test that needs the fields must first create an address.
- **`ApiCredentialRow` has no API key.** The endpoint returns only the entry's metadata, so reading it can never leak a secret. The same applies to the settings page object — the key is never displayed after creation.

---

## Anti-patterns

- An `expect` in a service.
- A service that is only a wrapper around UI clicks — that is a page-object method.
- A request made from **outside** the browser. The whole point is that the request is same-origin and carries the browser's session.
- A datatable request without the full query envelope — it answers HTTP 500.
- A request without `X-Requested-With: XMLHttpRequest` — it answers HTTP 403.
- Printing, logging or attaching the credentials or the session cookies.
- Asserting on a secret the service returned. The API-access rows carry metadata only, deliberately.
