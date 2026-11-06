import { sharedConfig } from './wdio.shared.conf';
import { IOS_DEVICE } from './config/devices';
import { env } from './src/shared/env';

/**
 * iOS configuration — **Safari on an iPhone 17 Simulator, driven by
 * XCUITest**.
 *
 * This is a *mobile web* session: the browser is Safari, the app under test
 * is the Shipmondo web platform, and there is **no** native app installed.
 * The `browserName` capability is what makes Appium hand the session to
 * Safari instead of to a native application.
 *
 * Prerequisites on the host (nothing is installed by this framework):
 *
 *  - Xcode with an iPhone 17 simulator runtime installed.
 *  - The Appium `xcuitest` driver installed for the host's Appium server:
 *    `appium driver install xcuitest`.
 *  - A simulator that is already booted, or one the Appium server may boot
 *    itself. Set `IOS_UDID` to pin the session to a specific simulator.
 *
 * ```bash
 * npm run test:ios
 * ```
 */
export const config = {
    ...sharedConfig,

    /**
     * The iOS mobile-web capabilities.
     *
     * Only Safari-specific options are listed here. The ones that matter:
     *
     *  - `browserName: 'Safari'` — the suite tests the web app, not an app.
     *  - `appium:autoWebview: false` — no hybrid app is involved.
     *  - `appium:noReset: true` — the simulator keeps its state, so the
     *    browser session and its cookies survive between tests.
     */
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

    /**
     * The base URL is set on the capability so that `browser.url('/path')`
     * resolves relative to the Shipmondo tenant.
     */
    baseUrl: env.baseURL,
};

export default config;
