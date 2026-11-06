/**
 * Allure command-line configuration.
 *
 * Consumed by `allure generate` (see the `allure:*` scripts in package.json).
 * The defaults match the reporter configuration in `wdio.shared.conf.ts`, so a
 * report can be generated straight from a run's `allure-results/` directory.
 */
export default {
    name: 'Shipmondo mobile-web (WebdriverIO + Appium 2)',
    clean: true,
    reportTitle: process.env.REPORT_TITLE ?? 'Shipmondo Mobile-Web Test Report',
};
