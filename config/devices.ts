/**
 * Device matrix — the single source of truth for "which handset does the
 * suite run on".
 *
 * The framework deliberately ships **no** device installation step: Xcode, the
 * iOS Simulator runtime, Android Studio and the Android system images are
 * expected to already exist on the host. Everything in this file is a
 * *description* of a device, not a download of one.
 *
 * Each entry carries the pieces that differ between platforms:
 *
 *  - `platformName`      — the W3C platform name.
 *  - `automationName`    — the Appium driver (`XCUITest` / `UiAutomator2`).
 *  - `browserName`       — the browser inside the device. This is what makes
 *                          the suite **mobile web**: Safari on iOS, Chrome on
 *                          Android — no native app under test.
 *  - `deviceName`        — the device the Appium server resolves.
 *  - `platformVersion`   — the OS version.
 *  - `viewport`          — the CSS viewport the browser reports, used by the
 *                          mobile-layout assertions.
 *  - `expectUserAgent`   — a fragment every real browser on that device must
 *                          report (asserted by the mobile-web suite).
 *
 * Override any field from the environment (see `.env.example`).
 */

/** A device description consumed by the platform configs. */
export interface DeviceProfile {
    /** W3C platform name. */
    platformName: 'iOS' | 'Android';
    /** The Appium automation engine for this platform. */
    automationName: 'XCUITest' | 'UiAutomator2';
    /** The browser under test — the suite is mobile *web*, not native. */
    browserName: 'Safari' | 'Chrome';
    /** Device name as known to the Appium server. */
    deviceName: string;
    /** OS version of the device image. */
    platformVersion: string;
    /** Optional UDID / serial of an already-booted device. */
    udid?: string;
    /** CSS viewport of the device, in CSS pixels. */
    viewport: { width: number; height: number };
    /** A user-agent fragment every browser on this device must contain. */
    expectUserAgent: string;
    /** How the user is expected to reach the browser: a tap on the home screen icon. */
    launch: string;
}

/** iPhone 17 family — the iOS target of the suite. */
export const IOS_DEVICE: DeviceProfile = {
    platformName: 'iOS',
    automationName: 'XCUITest',
    browserName: 'Safari',
    deviceName: process.env.IOS_DEVICE ?? 'iPhone 17 Pro',
    platformVersion: process.env.IOS_VERSION ?? '26.0',
    udid: process.env.IOS_UDID || undefined,
    viewport: { width: 402, height: 874 },
    expectUserAgent: 'iPhone',
    launch: 'Tap the Safari icon on the simulator home screen.',
};

/** Samsung Galaxy family — the Android target of the suite. */
export const ANDROID_DEVICE: DeviceProfile = {
    platformName: 'Android',
    automationName: 'UiAutomator2',
    browserName: 'Chrome',
    deviceName: process.env.ANDROID_DEVICE ?? 'Samsung Galaxy S25',
    platformVersion: process.env.ANDROID_OS ?? '15',
    udid: process.env.ANDROID_UDID || undefined,
    viewport: { width: 393, height: 852 },
    expectUserAgent: 'Android',
    launch: 'Tap the Chrome icon on the emulator home screen.',
};

/** Every device profile, keyed by platform — used by the docs and the audit agent. */
export const DEVICES: Record<'ios' | 'android', DeviceProfile> = {
    ios: IOS_DEVICE,
    android: ANDROID_DEVICE,
};
