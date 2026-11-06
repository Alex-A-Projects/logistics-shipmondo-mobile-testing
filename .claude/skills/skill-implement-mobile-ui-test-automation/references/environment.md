# Environment — variables, timeouts, the Appium service and the platform configs

## Table of contents

1. [Two independent axes](#two-independent-axes)
2. [`src/shared/env.ts`](#srcsharedenvts)
3. [The `.env` file](#the-env-file)
4. [The environment variables](#the-environment-variables)
5. [Timeouts](#timeouts)
6. [The Appium service](#the-appium-service)
7. [The two platform configs](#the-two-platform-configs)
8. [The device matrix](#the-device-matrix)
9. [The shared WebdriverIO config](#the-shared-webdriverio-config)
10. [Host prerequisites](#host-prerequisites)

---

## Two independent axes

The environment is deliberately split so that a run can never end up somewhere it did not ask for.

| Axis | Chosen by | What it selects |
|---|---|---|
| **UI environment** | `TEST_ENV` in `.env` | Which Shipmondo tenant the mobile browsers navigate to. It selects the base URL **only**. |
| **Device environment** | the **config file** you run | Which handset the Appium session drives. `wdio.ios.conf.ts` or `wdio.android.conf.ts`. Never an environment variable. |

---

## `src/shared/env.ts`

This module is the **only** place in the repository that reads `process.env`. Everything else imports from it.

```ts
export const UI_ENVIRONMENTS = ['demo', 'staging', 'release'] as const;
export type UiEnvironment = (typeof UI_ENVIRONMENTS)[number];
```

The resolution:

```ts
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
```

Both failures are **startup** failures: an unknown `TEST_ENV` or a missing base URL aborts the run before a device is touched, with a message that names the variable to set.

The `.env` file is loaded with `dotenv` from the project root:

```ts
export const projectRoot = process.env.PROJECT_ROOT
    ? path.resolve(process.env.PROJECT_ROOT)
    : process.cwd();

dotenv.config({ path: path.join(projectRoot, '.env') });
```

`PROJECT_ROOT` overrides the root for monorepos and IDE runners with a different working directory. WebdriverIO always starts at the repository root.

### The public surface

```ts
export const env = {
    testEnv: TEST_ENV as UiEnvironment,
    baseURL: normalizedBaseURL,
    loginPath,
    appPath,
    dashboardRoute,
    reportTitle: process.env.REPORT_TITLE ?? 'Shipmondo Mobile-Web Test Report',
} as const;

export const credentials = {
    email: webUser,
    password: webPassword,
    available: Boolean(webUser && webPassword),
} as const;

export const MISSING_CREDENTIALS =
    'Shipmondo web credentials are missing. Set SHIPMONDO_WEB_USER and ' +
    'SHIPMONDO_WEB_PASSWORD in .env (see .env.example) before running the mobile suite.';

export const TICKET_PREFIX = (process.env.TICKET_PREFIX ?? 'SHIP').toUpperCase();
```

`env.appPath` is `/main/app` and `env.dashboardRoute` is `#/dashboard` — the prefix of the AngularJS single-page application and its dashboard route.

`MISSING_CREDENTIALS` is thrown by the fixture and by `AuthService.signIn()` when the credentials are absent. It is a single message, referenced from both places, so the guidance is identical wherever it surfaces.

### The file paths

`src/shared/paths.ts` resolves every location the framework touches:

```ts
export const Paths = {
    repoRoot: projectRoot,
    configDir: path.join(projectRoot, 'config'),
    testPolicyFile: path.join(projectRoot, 'config', 'test-policy.json'),
    devicesFile: path.join(projectRoot, 'config', 'devices.ts'),
    rootEnvFile: path.join(projectRoot, '.env'),
    srcDir: path.join(projectRoot, 'src'),
    mobileDir: path.join(projectRoot, 'src', 'mobile'),
    testsDir: path.join(projectRoot, 'tests-mobile'),
    allureResultsDir: path.join(projectRoot, 'allure-results'),
    allureReportDir: path.join(projectRoot, 'allure-report'),
    screenshotsDir: path.join(projectRoot, 'allure-results', 'screenshots'),
} as const;
```

The project is ESM, so `__dirname` is unavailable; the root is resolved from `PROJECT_ROOT` or the working directory.

---

## The `.env` file

Copy the template and fill it in. **Never commit a filled-in `.env`.**

```bash
cp .env.example .env
```

The only mandatory values are the two credentials and the base URL for the environment under test. Everything else has a safe default in `src/shared/env.ts`.

---

## The environment variables

| Variable | Purpose | Default |
|---|---|---|
| `TEST_ENV` | Which tenant to navigate to: `demo`, `staging`, `release` | `demo` |
| `DEMO_BASE_URL` | Base URL of the demo tenant | — (required for `TEST_ENV=demo`) |
| `STAGING_BASE_URL` | Base URL of the staging tenant | — |
| `RELEASE_BASE_URL` | Base URL of the release tenant | — |
| `SHIPMONDO_WEB_USER` | The account address for the web app | — (required) |
| `SHIPMONDO_WEB_PASSWORD` | The account password for the web app | — (required) |
| `SHIPMONDO_LOGIN_PATH` | Path of the login page, relative to the base URL | `/account/login?locale=en` |
| `WDIO_APPIUM_SERVICE` | `false` attaches to an Appium server that is already running | `true` |
| `APPIUM_HOST` | Host of the Appium server | `localhost` |
| `APPIUM_PORT` | Port of the Appium server | `4723` |
| `APPIUM_ARGS` | Extra arguments for the managed server, space separated | — |
| `APPIUM_LOG_LEVEL` | Log level of the managed server: `error`, `warn`, `info`, `debug` | `info` |
| `IOS_DEVICE` | Device name for the iOS target | `iPhone 17 Pro` |
| `IOS_VERSION` | iOS version | `26.0` |
| `IOS_UDID` | UDID of an already-booted simulator | — |
| `ANDROID_DEVICE` | Device name for the Android target | `Samsung Galaxy S25` |
| `ANDROID_OS` | Android version | `15` |
| `ANDROID_UDID` | Serial of an already-running emulator | — |
| `CHROMEDRIVER_PATH` | Path to a local chromedriver binary | — |
| `TICKET_PREFIX` | Prefix of the test titles | `SHIP` |
| `WAIT_FOR_DISPLAYED` | `waitForDisplayed` / `waitForExist` budget, in ms | `20000` |
| `WAIT_FOR_PAGE_LOAD` | Page and navigation budget, in ms | `60000` |
| `WAIT_FOR_SCRIPT` | `browser.execute` budget, in ms | `20000` |
| `REPORT_TITLE` | Title shown in the console banner and the Allure report | `Shipmondo Mobile-Web Test Report` |
| `PROJECT_ROOT` | Overrides the repository root | the working directory |

---

## Timeouts

```ts
const intEnv = (name: string, fallback: number): number => {
    const raw = process.env[name];
    const parsed = Number(raw);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

export const timeouts = {
    waitForDisplayed: intEnv('WAIT_FOR_DISPLAYED', 20_000),
    pageLoad: intEnv('WAIT_FOR_PAGE_LOAD', 60_000),
    script: intEnv('WAIT_FOR_SCRIPT', 20_000),
} as const;
```

Mobile browsers are slower than desktop ones, so every budget is generous. But a generous budget is not a licence to sleep: every wait in the suite is a **state** wait, and the budget only says how long that state is given to appear.

The Mocha test timeout is separate and lives in the shared config: `mochaOpts.timeout` is `120_000`.

---

## The Appium service

```ts
export const appium = {
    host: process.env.APPIUM_HOST ?? 'localhost',
    port: Number(process.env.APPIUM_PORT ?? 4723),
    path: '/wd/hub',
    managed: (process.env.WDIO_APPIUM_SERVICE ?? 'true').toLowerCase() !== 'false',
    args: (process.env.APPIUM_ARGS ?? '')
        .split(' ')
        .map((arg) => arg.trim())
        .filter(Boolean),
} as const;
```

The shared WebdriverIO config turns it into a service:

```ts
services: appium.managed
    ? [
          [
              'appium',
              {
                  port: appium.port,
                  host: appium.host,
                  loglevel: (process.env.APPIUM_LOG_LEVEL as 'error' | 'warn' | 'info' | 'debug') ?? 'info',
                  args: {
                      basePath: '/',
                  },
              },
          ],
      ]
    : [],
```

- **`WDIO_APPIUM_SERVICE=true` (default)** — WebdriverIO starts the Appium 2 server itself and stops it at the end of the run. The driver packages (`xcuitest`, `uiautomator2`) must already be installed for the host's Appium.
- **`WDIO_APPIUM_SERVICE=false`** — the suite attaches to an Appium server that is already running. This is the mode to use in CI, where the server is a service.

The framework ships **no** device installation step. Xcode, the iOS Simulator runtime, Android Studio and the Android system images are expected to exist on the host already.

---

## The two platform configs

Both extend `sharedConfig` and add only the capabilities that differ.

### `wdio.ios.conf.ts` — Safari on an iPhone 17 simulator (XCUITest)

```ts
capabilities: [
    {
        platformName: IOS_DEVICE.platformName,
        'appium:automationName': IOS_DEVICE.automationName,
        'appium:deviceName': IOS_DEVICE.deviceName,
        'appium:platformVersion': IOS_DEVICE.platformVersion,
        ...(IOS_DEVICE.udid ? { 'appium:udid': IOS_DEVICE.udid } : {}),
        browserName: IOS_DEVICE.browserName,
        'appium:autoWebview': false,
        'appium:noReset': true,
        'appium:fullReset': false,
        'appium:newCommandTimeout': 300,
        'appium:safariAllowPopups': true,
        'appium:safariIgnoreFraudWarning': true,
        'appium:shouldUseCompactMode': true,
        'appium:shouldUseSingletonTestManager': true,
        'appium:reduceMotion': true,
    },
],
```

The capability that makes this a *mobile web* session is `browserName: 'Safari'`. There is no native app: the `browserName` is what makes Appium hand the session to the browser instead of to an application. `autoWebview: false` confirms no hybrid app is involved, and `noReset: true` keeps the simulator's state so the browser session and its cookies survive between tests.

### `wdio.android.conf.ts` — Chrome on a Samsung Galaxy S25 emulator (UiAutomator2)

```ts
capabilities: [
    {
        platformName: ANDROID_DEVICE.platformName,
        'appium:automationName': ANDROID_DEVICE.automationName,
        'appium:deviceName': ANDROID_DEVICE.deviceName,
        'appium:platformVersion': ANDROID_DEVICE.platformVersion,
        ...(ANDROID_DEVICE.udid ? { 'appium:udid': ANDROID_DEVICE.udid } : {}),
        browserName: ANDROID_DEVICE.browserName,
        'appium:noReset': true,
        'appium:fullReset': false,
        'appium:newCommandTimeout': 300,
        'appium:chromedriverAutodownload': true,
        'appium:skipDeviceInitialization': false,
        'appium:disableWindowAnimation': true,
        'appium:ignoreUnimportantViews': false,
    },
],
```

`browserName: 'Chrome'` hands the session to Chrome; the Appium driver launches it on the emulator and exposes its DOM over the WebDriver protocol. `chromedriverAutodownload` asks the driver to fetch a matching chromedriver on demand; set `CHROMEDRIVER_PATH` to use a local binary instead.

---

## The device matrix

`config/devices.ts` is the single source of truth for "which handset does the suite run on".

```ts
export interface DeviceProfile {
    platformName: 'iOS' | 'Android';
    automationName: 'XCUITest' | 'UiAutomator2';
    browserName: 'Safari' | 'Chrome';
    deviceName: string;
    platformVersion: string;
    udid?: string;
    viewport: { width: number; height: number };
    expectUserAgent: string;
    launch: string;
}
```

| | iOS | Android |
|---|---|---|
| `platformName` | `iOS` | `Android` |
| `automationName` | `XCUITest` | `UiAutomator2` |
| `browserName` | `Safari` | `Chrome` |
| `deviceName` | `iPhone 17 Pro` | `Samsung Galaxy S25` |
| `platformVersion` | `26.0` | `15` |
| `viewport` | 402 × 874 | 393 × 852 |
| `expectUserAgent` | `iPhone` | `Android` |

The viewport is the CSS pixel size the browser reports, and it is what the mobile-layout assertions are written against. The same spec reads the profile of the *running* platform, so it asserts the right expectation on an iPhone and on a Galaxy.

---

## The shared WebdriverIO config

`wdio.shared.conf.ts` holds everything identical between the two runs:

```ts
specs: [path.join(projectRoot, 'tests-mobile', '**', '*.spec.ts')],
framework: 'mocha',
maxInstances: 1,
runner: 'local',
reporters: ['spec', ['allure', { outputDir: allureResultsDir, clean: true }]],
mochaOpts: {
    ui: 'bdd',
    timeout: 120_000,
    require: [],
},
waitforTimeout: timeouts.waitForDisplayed,
connectionRetryTimeout: 120_000,
connectionRetryCount: 3,
baseUrl: env.baseURL,
```

- **`maxInstances: 1`** — one device at a time; a second instance would fight over the same simulator.
- **`baseUrl`** — every relative navigation resolves against the tenant.
- **`waitforTimeout`** is the default budget for a *single* WebDriver command. It is not a substitute for a condition wait.

The `before` hook prints the run banner:

```ts
before: async () => {
    console.log(
        `\n▶ ${env.reportTitle}\n` +
            `  environment : ${env.testEnv}\n` +
            `  base URL    : ${env.baseURL}\n` +
            `  appium      : ${appium.managed ? 'managed by the runner' : 'external'}\n`,
    );
},
```

Note what it prints: the report title, the environment, the base URL and how Appium is being provided. It does **not** print the credentials.

---

## Host prerequisites

The framework installs nothing on the host. Before the first run:

**iOS**

- Xcode with an iPhone 17 simulator runtime installed.
- The Appium `xcuitest` driver for the host's Appium server: `appium driver install xcuitest`.
- A booted simulator, or one the Appium server may boot itself; set `IOS_UDID` to pin the session.

**Android**

- Android Studio with a Samsung Galaxy system image and an AVD created from it.
- The Appium `uiautomator2` driver: `appium driver install uiautomator2`.
- A chromedriver matching the emulator's Chrome version, or `chromedriverAutodownload` left enabled.

**Both**

- Node.js 20 or newer (`engines` in `package.json`).
- Java on the `PATH`, which the Allure command line requires.
