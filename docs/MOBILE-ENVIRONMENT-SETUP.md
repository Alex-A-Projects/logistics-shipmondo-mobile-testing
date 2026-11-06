# Mobile environment setup

**Document version:** 2026-11-06
**Audience:** QA Engineers, CI maintainers, whoever provisions a host
**Purpose:** What the machine must provide before the suite can run, and the
exact commands a **human** runs to provide it.

---

## 1. The rule that shapes this document

> **The framework installs nothing.**

No npm script, no npm hook, no CI step and no documentation in this
repository installs Xcode, an iOS Simulator runtime, Android Studio, an
Android system image, an AVD, an Appium driver or the Appium server.

The framework **describes** its target environments. A human provisions them.
That is the whole difference, and it is deliberate:

- the repository's dependency surface stays auditable — the only things it
  installs are npm packages, pinned in `package.json`;
- the same suite runs unchanged on a laptop and on a CI worker that already
  provides the device;
- an environment problem is reported as an environment problem, instead of
  being silently worked around from inside a test run.

Everything below is therefore a command **for you to run**, not for the
framework to run.

---

## 2. What has to exist

| | iOS | Android |
|---|---|---|
| Toolchain | Xcode 16+ with the Command Line Tools | Android Studio + the Android SDK |
| Device | an iPhone 17 simulator (runtime installed) | a Samsung Galaxy S25 AVD (system image installed) |
| Browser | Safari — part of the iOS runtime | Chrome — on the emulator image |
| Appium driver | `xcuitest` | `uiautomator2` |
| Server | Appium 2 (started by the runner, or your own) | the same |

Plus, always:

- **Node.js 20+**
- the repository's own dependencies: `npm install`
- a filled-in `.env` (see § 5)

---

## 3. iOS

### 3.1 What to check

```bash
xcode-select -p          # the Xcode path
xcrun simctl list runtimes   # the installed simulator runtimes
xcrun simctl list devices    # the available devices
```

The runtime line must include an iOS version that has an **iPhone 17**
device, and the device line must include that device — the suite's default
profile is `iPhone 17 Pro`.

### 3.2 Providing it (human action)

```bash
# In Xcode: Xcode ▸ Settings ▸ Platforms
#   - download the iOS runtime that carries an iPhone 17 device
#   - Xcode ▸ Settings ▸ Components
#   - install the simulator runtime if it is not bundled
```

Or, from the command line, with a matching Xcode:

```bash
xcodebuild -downloadPlatform iOS
```

### 3.3 Booting the simulator

```bash
xcrun simctl boot "iPhone 17 Pro"
open -a Simulator
```

The suite can boot the device itself, but a **booted** simulator is faster
and far easier to debug — the failure screenshot and the browser state are
visible.

### 3.4 The Appium driver

```bash
appium driver list --installed
# → xcuitest ✔

# if it is missing, a human installs it:
appium driver install xcuitest
```

### 3.5 The Safari session

Safari is part of the iOS runtime — there is nothing to install. On the first
run the simulator may ask to accept the "Automatically allow…" prompt; accept
it, or the automation driver will not be able to interact with the browser.

---

## 4. Android

### 4.1 What to check

```bash
adb devices -l
avdmanager list avd
emulator -list-avds
```

The suite's default profile is `Samsung Galaxy S25`. If the AVD has another
name, either rename it, or point the suite at it:

```bash
ANDROID_DEVICE="Pixel_8_API_35" npm run test:android
```

### 4.2 Providing it (human action)

```bash
# In Android Studio: More Actions ▸ Virtual Device Manager ▸ Create Device
#   - pick a device whose name matches the suite's profile, or note its name
#   - pick a system image (API 34/35, Google APIs or Google Play)
```

Or, from the command line:

```bash
sdkmanager "system-images;android-15;google_apis;x86_64"
avdmanager create avd -n "Samsung Galaxy S25" -k "system-images;android-15;google_apis;x86_64"
```

### 4.3 Booting the emulator

```bash
emulator -avd "Samsung Galaxy S25" &
adb wait-for-device
```

On an Apple-silicon host, add `-gpu swiftshader_indirect` if the emulator
does not render.

### 4.4 Chrome and Chromedriver

Chrome is on the emulator image. Its driver must **match the Chrome version
on that image** — a mismatch is the single most common cause of a session
that starts and then dies.

```bash
adb shell dumpsys package com.android.chrome | grep versionName
```

Compare it with the driver's version, and update the driver's Chrome
configuration if they differ:

```bash
appium driver install uiautomator2
npm install -g appium-chromedriver   # if the suite's driver needs an explicit one
```

### 4.5 The Appium driver

```bash
appium driver list --installed
# → uiautomator2 ✔

appium driver install uiautomator2
```

---

## 5. The repository's own configuration

```bash
npm install
cp .env.example .env
```

Then fill in `.env`:

```dotenv
TEST_ENV=demo
DEMO_BASE_URL=https://demo.shipmondo.com
SHIPMONDO_WEB_USER=<the account address>
SHIPMONDO_WEB_PASSWORD=<the password>
SHIPMONDO_LOGIN_PATH=/account/login

WDIO_APPIUM_SERVICE=true
APPIUM_HOST=127.0.0.1
APPIUM_PORT=4723
```

- `.env` is **gitignored**. Never commit a filled-in copy, and never paste a
  credential into a command line, a log, an Allure attachment or a commit.
- In CI, set the same names as pipeline variables.

### The device is not an environment variable

`TEST_ENV` chooses the **tenant**. The **device** is chosen by the config
file you run — `wdio.ios.conf.ts` or `wdio.android.conf.ts` — so a run can
never end up on a device it did not ask for. The device *name* can still be
overridden (`IOS_DEVICE`, `ANDROID_DEVICE`), but the platform and the browser
are fixed by the config.

---

## 6. The Appium server

Two modes, chosen by `WDIO_APPIUM_SERVICE`:

| Value | Behaviour |
|---|---|
| `true` (default) | the runner starts its own Appium server via `@wdio/appium-service` |
| `false` | the suite talks to a server you started yourself, at `APPIUM_HOST:APPIUM_PORT` |

To run your own:

```bash
appium --port 4723
```

```bash
WDIO_APPIUM_SERVICE=false npm run test:android
```

The service starts a server. It does not install one, and it does not install
drivers.

---

## 7. Verifying the host

### The typecheck

```bash
npm run typecheck
```

Needs no device. It proves the code compiles — nothing more.

### The spec-collection check

```bash
npx wdio run wdio.ios.conf.ts --dry-run
```

Collects the specs and checks the feature gate without creating a session.

### The real check

```bash
npm run test:ios       # needs a booted iPhone 17 simulator + the xcuitest driver
npm run test:android   # needs a running Galaxy emulator + the uiautomator2 driver
```

### The audit agent

The `mobile-environment-audit` agent answers "can this host run the suite?"
with a READY / NOT READY verdict per platform, and names the missing piece.
**It never installs anything** — that boundary is hard-coded into the agent.

---

## 8. Common problems

| Symptom | Cause | Fix |
|---|---|---|
| `Could not find a connected Android device` | the emulator is not running | boot it, then `adb devices -l` |
| `NoSuchDriverError` | the platform's Appium driver is missing | `appium driver install xcuitest` / `uiautomator2` |
| The session starts, then dies on the first command | the Chrome driver does not match the emulator's Chrome | align the versions (§ 4.4) |
| `No devices found` on iOS | the simulator is not booted | `xcrun simctl boot "iPhone 17 Pro"` |
| The browser opens a desktop layout | the device profile is wrong | check `IOS_DEVICE` / `ANDROID_DEVICE` against `xcrun simctl list devices` and `avdmanager list avd` |
| `Unknown TEST_ENV` | `TEST_ENV` is misspelled | `demo`, `staging` or `release` |
| `No base URL resolved` | `DEMO_BASE_URL` is missing from `.env` | fill it in |
| `Feature tag(s) not declared` | a typo in a feature tag | fix the tag; the declared list is in the error message |

---

## 9. In CI

The CI worker must provide the device. A typical runner does:

1. check out the repository;
2. `npm ci`;
3. start the emulator / boot the simulator;
4. `npm run test:android` (or `:ios`);
5. publish `allure-results/`.

The steps that **provision** the device (installing a runtime, downloading a
system image, installing a driver) belong to the runner's image, not to this
repository. If the runner image does not have them, the job fails with an
environment error — which is the correct and honest outcome.

---

## 10. Summary

| Question | Answer |
|---|---|
| Does the suite install a simulator? | No. Never. |
| Does it install an emulator or a system image? | No. |
| Does it install an Appium driver? | No. |
| Does it start an Appium server? | It may start one — `WDIO_APPIUM_SERVICE=true`. It does not install one. |
| What does it install? | npm packages, pinned in `package.json`. |
| What does a human have to do? | Provision the simulator/emulator and the drivers, and fill in `.env`. |
