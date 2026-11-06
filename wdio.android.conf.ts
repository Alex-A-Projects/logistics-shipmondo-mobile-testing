import { sharedConfig } from './wdio.shared.conf';
import { ANDROID_DEVICE } from './config/devices';
import { env } from './src/shared/env';

/**
 * Android configuration — **Chrome on a Samsung Galaxy Emulator, driven by
 * UiAutomator2**.
 *
 * This is a *mobile web* session: the browser is Chrome, the app under test
 * is the Shipmondo web platform, and there is **no** native app installed.
 *
 * Prerequisites on the host (nothing is installed by this framework):
 *
 *  - Android Studio with a Samsung Galaxy system image and an AVD created
 *    from it.
 *  - The Appium `uiautomator2` driver installed for the host's Appium
 *    server: `appium driver install uiautomator2`.
 *  - Chromedriver matching the Chrome version on the emulator. The
 *    `chromedriverAutodownload` capability below asks the driver to fetch
 *    it on demand; set `CHROMEDRIVER_PATH` to use a local binary instead.
 *
 * ```bash
 * npm run test:android
 * ```
 */
export const config = {
    ...sharedConfig,

    /**
     * The Android mobile-web capabilities.
     *
     * `browserName: 'Chrome'` hands the session to Chrome; the Appium
     * driver then launches the browser on the emulator and exposes its DOM
     * over the WebDriver protocol.
     */
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

    /**
     * The base URL is set on the capability so that `browser.url('/path')`
     * resolves relative to the Shipmondo tenant.
     */
    baseUrl: env.baseURL,
};

export default config;
