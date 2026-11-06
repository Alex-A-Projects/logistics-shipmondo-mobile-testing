/**
 * Environment resolution — the only place that reads `process.env`.
 *
 * Two independent axes, deliberately kept apart:
 *
 *  - **UI environment** (`TEST_ENV`) — which Shipmondo tenant the mobile
 *    browsers navigate to. It selects the base URL only.
 *  - **Device environment** — which handset the Appium session drives. That
 *    is chosen by the *config file* you run (`wdio.ios.conf.ts` or
 *    `wdio.android.conf.ts`), never by an environment variable, so a run can
 *    never end up on a device it did not ask for.
 *
 * Secrets never reach the command line: credentials come from `.env` (which
 * is gitignored) or from CI variables. Nothing in this module prints them.
 */
import dotenv from 'dotenv';
import path from 'path';

// The project root is the directory the runner was started from. WDIO always
// runs from the repository root, and `PROJECT_ROOT` overrides it for unusual
// setups (monorepos, IDE runners with a different working directory).
export const projectRoot = process.env.PROJECT_ROOT
    ? path.resolve(process.env.PROJECT_ROOT)
    : process.cwd();

dotenv.config({ path: path.join(projectRoot, '.env') });

// ---------------------------------------------------------------------------
// Axis 1 — UI environment (navigation only)
// ---------------------------------------------------------------------------

export const UI_ENVIRONMENTS = ['demo', 'staging', 'release'] as const;
export type UiEnvironment = (typeof UI_ENVIRONMENTS)[number];

const TEST_ENV = (process.env.TEST_ENV ?? 'demo').toLowerCase();

if (!UI_ENVIRONMENTS.includes(TEST_ENV as UiEnvironment)) {
    throw new Error(
        `Unknown TEST_ENV="${TEST_ENV}". Expected one of: ${UI_ENVIRONMENTS.join(', ')}.`,
    );
}

const baseUrlByEnv: Record<UiEnvironment, string | undefined> = {
    demo: process.env.DEMO_BASE_URL,
    staging: process.env.STAGING_BASE_URL,
    release: process.env.RELEASE_BASE_URL,
};

const baseURL = baseUrlByEnv[TEST_ENV as UiEnvironment];

if (!baseURL) {
    throw new Error(
        `No base URL resolved for TEST_ENV="${TEST_ENV}". ` +
            `Set ${TEST_ENV.toUpperCase()}_BASE_URL in .env (see .env.example).`,
    );
}

/** The base URL without a trailing slash. */
export const normalizedBaseURL = baseURL.replace(/\/+$/, '');

// ---------------------------------------------------------------------------
// Credentials
// ---------------------------------------------------------------------------

const webUser = process.env.SHIPMONDO_WEB_USER ?? '';
const webPassword = process.env.SHIPMONDO_WEB_PASSWORD ?? '';

export const credentials = {
    email: webUser,
    password: webPassword,
    /** True when both parts are present — the suite refuses to run without them. */
    available: Boolean(webUser && webPassword),
} as const;

export const MISSING_CREDENTIALS =
    'Shipmondo web credentials are missing. Set SHIPMONDO_WEB_USER and ' +
    'SHIPMONDO_WEB_PASSWORD in .env (see .env.example) before running the mobile suite.';

// ---------------------------------------------------------------------------
// Appium
// ---------------------------------------------------------------------------

export const appium = {
    host: process.env.APPIUM_HOST ?? 'localhost',
    port: Number(process.env.APPIUM_PORT ?? 4723),
    path: '/wd/hub',
    /**
     * Whether WebdriverIO should start (and stop) its own Appium server.
     *
     * `true`  — the suite owns the Appium lifecycle; the driver packages are
     *            expected to be installed already (`appium driver install ...`).
     * `false` — an Appium instance is already running at APPIUM_HOST:APPIUM_PORT.
     */
    managed: (process.env.WDIO_APPIUM_SERVICE ?? 'true').toLowerCase() !== 'false',
    /** Extra arguments for the managed server, e.g. `--log-level=debug`. */
    args: (process.env.APPIUM_ARGS ?? '')
        .split(' ')
        .map((arg) => arg.trim())
        .filter(Boolean),
} as const;

// ---------------------------------------------------------------------------
// Application routes
// ---------------------------------------------------------------------------

/** The login page, relative to the base URL. `?email=` pre-fills the address. */
export const loginPath = process.env.SHIPMONDO_LOGIN_PATH ?? '/account/login?locale=en';

/** The AngularJS single-page application lives under this prefix. */
export const appPath = '/main/app';

/** The dashboard route of the SPA. */
export const dashboardRoute = '#/dashboard';

// ---------------------------------------------------------------------------
// Timeouts
// ---------------------------------------------------------------------------

const intEnv = (name: string, fallback: number): number => {
    const raw = process.env[name];
    const parsed = Number(raw);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

export const timeouts = {
    /** `waitForDisplayed` / `waitForExist` budget. */
    waitForDisplayed: intEnv('WAIT_FOR_DISPLAYED', 20_000),
    /** Page/navigation budget. */
    pageLoad: intEnv('WAIT_FOR_PAGE_LOAD', 60_000),
    /** `browser.execute` budget. */
    script: intEnv('WAIT_FOR_SCRIPT', 20_000),
} as const;

// ---------------------------------------------------------------------------
// Ticket prefix
// ---------------------------------------------------------------------------

export const TICKET_PREFIX = (process.env.TICKET_PREFIX ?? 'SHIP').toUpperCase();

// ---------------------------------------------------------------------------
// Public surface
// ---------------------------------------------------------------------------

export const env = {
    /** UI environment name — drives navigation. */
    testEnv: TEST_ENV as UiEnvironment,
    /** Base URL the mobile browsers navigate to. */
    baseURL: normalizedBaseURL,
    /** Login page path, relative to the base URL. */
    loginPath,
    /** Prefix of the SPA. */
    appPath,
    /** Dashboard route of the SPA. */
    dashboardRoute,
    /** Report title used in the console banner and the Allure report. */
    reportTitle: process.env.REPORT_TITLE ?? 'Shipmondo Mobile-Web Test Report',
} as const;
