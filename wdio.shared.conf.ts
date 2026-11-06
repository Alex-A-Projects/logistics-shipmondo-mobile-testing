import path from 'path';
import { browser } from '@wdio/globals';
import { appium, env, projectRoot, timeouts } from './src/shared/env';

/**
 * The shared WebdriverIO configuration.
 *
 * Everything that is identical between the iOS and the Android run lives
 * here: the spec glob, the Mocha options, the reporters, the Appium
 * service and the failure handling. The platform configs add only the
 * capabilities that differ.
 *
 * The framework ships **no** device installation step. Xcode, the iOS
 * Simulator runtime, Android Studio and the Android system images are
 * expected to exist on the host already; the Appium drivers (`xcuitest`,
 * `uiautomator2`) are expected to be installed for the host's Appium
 * server. See `docs/MOBILE-ENVIRONMENT-SETUP.md`.
 */

/** Where the raw Allure results are written. */
export const allureResultsDir = path.join(projectRoot, 'allure-results');

/**
 * Screenshots of failing tests.
 *
 * The file name is derived from the test title, sanitised so it is a valid
 * file name on every platform.
 */
function screenshotName(title: string): string {
    const safe = title
        .replace(/[^a-zA-Z0-9._-]+/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_|_$/g, '')
        .slice(0, 120);
    return safe.length > 0 ? safe : 'failure';
}

export const sharedConfig = {
    /**
     * The mobile-web spec tree.
     *
     * Every file under `tests-mobile/` is a mobile-web spec — the suite
     * covers nothing else.
     */
    specs: [path.join(projectRoot, 'tests-mobile', '**', '*.spec.ts')],

    /** Mocha is the test framework of the suite. */
    framework: 'mocha',

    /** One device at a time: a second instance would fight over the same simulator. */
    maxInstances: 1,

    runner: 'local',

    /**
     * The Appium service.
     *
     * `WDIO_APPIUM_SERVICE=false` attaches to an Appium server that is
     * already running (handy in CI, where the server is a service).
     */
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

    /** The reporter stack: a readable console log and a rich HTML report. */
    reporters: ['spec', ['allure', { outputDir: allureResultsDir, clean: true }]],

    /** The Mocha options — one test at a time, with a generous budget. */
    mochaOpts: {
        ui: 'bdd',
        timeout: 120_000,
        require: [],
    },

    /**
     * The default wait for a single WebDriver command.
     *
     * Appium round trips over a device are slow, so the default is
     * generous — but every *waits* in the suite are condition-based
     * (`waitForDisplayed`, `waitUntil`), never sleeps.
     */
    waitforTimeout: timeouts.waitForDisplayed,

    /** The default timeout for `browser.execute`. */
    connectionRetryTimeout: 120_000,
    connectionRetryCount: 3,

    /** The base URL every relative navigation is resolved against. */
    baseUrl: env.baseURL,

    /**
     * Runs once before the session is created.
     *
     * The Appium server has to be up before the capability is negotiated.
     */
    before: async () => {
        // eslint-disable-next-line no-console
        console.log(
            `\n▶ ${env.reportTitle}\n` +
                `  environment : ${env.testEnv}\n` +
                `  base URL    : ${env.baseURL}\n` +
                `  appium      : ${appium.managed ? 'managed by the runner' : 'external'}\n`,
        );
    },

    /**
     * Runs after every test.
     *
     * A failing test leaves a screenshot in the Allure results directory, so
     * the report shows what the phone actually displayed.
     */
    afterTest: async (
        test: { title?: string; titlePath?: (string | number)[] },
        context: { error?: Error },
    ) => {
        if (!context.error) {
            return;
        }

        const title = test.titlePath?.join(' ') ?? test.title ?? 'failure';
        const file = path.join(allureResultsDir, `${screenshotName(title)}.png`);

        try {
            await browser.saveScreenshot(file);
        } catch {
            // A screenshot is a diagnostic aid, never a reason to fail a test
            // that has already failed for its own reason.
        }
    },
} as const;

export default sharedConfig;
