/**
 * Selectors verified against the live Shipmondo demo app.
 *
 * The Shipmondo DOM carries **no** `data-testid` attribute, so every selector
 * here is derived from the real markup.
 *
 * Two structural facts drive most of these selectors:
 *
 *  1. Every list page renders its table **twice** — a header-only clone
 *     (`table.dataTable`, no rows) and the scrolling body table
 *     (`table.dataTable` with rows). Only the body table holds data.
 *  2. Column 1 of every list is the row-select checkbox column, so the first
 *     *meaningful* column is column 2.
 *
 * Mobile-web notes
 * ----------------
 * The app is a responsive admin theme. On a phone the left navigation lives
 * in an off-canvas drawer (`#left-panel`) behind a hamburger toggle, and the
 * shell adds `body.mobile-view-activated` while the drawer is open. The
 * selectors below therefore include the drawer toggle and the backdrop, and
 * the components detect the drawer state rather than assuming it.
 */

/** The app shell's main content region. */
export const CONTENT = '#content';

/**
 * Route-specific class on `#content`.
 *
 * The SPA swaps the content region in place and stamps the *active route's*
 * class onto it. This is the only reliable "which route am I on" signal that
 * survives the transition, so readiness waits key on it rather than on a
 * generic control.
 */
export const ROUTE_CONTENT_CLASS = {
    dashboard: 'dashboard',
    orders: 'order-content',
    shipments: 'shipping-labels-content',
    shipmentDrafts: 'shipping-label-draft-content',
    addressBook: 'address-book-content',
    apiAccess: 'api-credential-content',
} as const;

/** The routes the mobile suite addresses. */
export type RouteKey = keyof typeof ROUTE_CONTENT_CLASS;

/** CSS selector matching `#content` only on the given route. */
export function routeContent(route: RouteKey): string {
    return `${CONTENT}.${ROUTE_CONTENT_CLASS[route]}`;
}

/**
 * XPath matching the route's own DataTables body table.
 *
 * XPath is used instead of the CSS `:has()` pseudo-class because Appium's
 * selector engines (XCUITest on iOS, UiAutomator2 on Android) do not
 * implement it consistently. The body table is the one that owns a `tbody`
 * with rows — the header-only clone has none.
 */
export function routeTableXPath(route: RouteKey): string {
    return (
        `//*[@id="content"][contains(@class,"${ROUTE_CONTENT_CLASS[route]}")]` +
        '//table[contains(@class,"dataTable")][.//tbody/tr]'
    );
}

/** XPath matching the route's content region. */
export function routeContentXPath(route: RouteKey): string {
    return `//*[@id="content"][contains(@class,"${ROUTE_CONTENT_CLASS[route]}")]`;
}

/** The data-bearing table of a DataTables-style list. */
export const DATATABLE_BODY_TABLE = '#content table.dataTable';

/** The left navigation panel (off-canvas drawer on a phone). */
export const SIDEBAR_PANEL = '#left-panel';

/** A collapsible navigation group (its `<ul>` is hidden until expanded). */
export const SIDEBAR_GROUP = '#left-panel li[data-menu-collapse]';

/**
 * Candidate selectors for the hamburger that opens the mobile drawer.
 *
 * The theme ships the toggle as `#hide-menu`; the remaining candidates keep
 * the suite working against a slightly different theme build. The component
 * picks the first one that actually exists in the DOM.
 */
export const NAVIGATION_TOGGLES: readonly string[] = [
    '#hide-menu',
    '#mobile-menu-toggle',
    '.navbar-toggle',
    '[data-toggle="sidebar"]',
];

/** The translucent backdrop that closes the mobile drawer. */
export const NAVIGATION_BACKDROP = '#navigation-backdrop';

/** The visible search box above a DataTables-style list. */
export const SEARCH_INPUT = '#content input.simple-search';

/** The environment badge in the header (e.g. "Demo"). */
export const ENVIRONMENT_BADGE = '#logo-group .label';

/** The signed-in account name shown in the header. */
export const ACCOUNT_NAME = '#header .company-name';

/** The profile dropdown trigger in the header (the avatar on mobile). */
export const PROFILE_MENU = '#mobile-profile-img';

/** The DataTables "no records" cell. */
export const EMPTY_CELL = '#content td.dataTables_empty';

/** The DataTables paging-info element ("Showing 1 to 25 of 68 entries"). */
export const TABLE_INFO = '.dataTables_info';

/** The invalid-credentials alert on the login page. */
export const LOGIN_ERROR = '.alert.alert-danger';

/** The e-mail field of the login form. */
export const LOGIN_EMAIL = '#user_email';

/** The password field of the login form. */
export const LOGIN_PASSWORD = '#user_password';

/** The "remember me" checkbox of the login form. */
export const LOGIN_REMEMBER_ME = '#user_remember_me';

/** The submit button of the login form. */
export const LOGIN_SUBMIT = 'input[type=submit]';

/** The inline client-side validation message of the e-mail field. */
export const LOGIN_EMAIL_ERROR = '#user_email-error';

/** The inline client-side validation message of the password field. */
export const LOGIN_PASSWORD_ERROR = '#user_password-error';
