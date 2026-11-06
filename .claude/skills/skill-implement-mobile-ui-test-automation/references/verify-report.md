# Verification and reporting

## Table of contents

1. [Running the suite](#running-the-suite)
2. [Running one spec](#running-one-spec)
3. [Running by tag](#running-by-tag)
4. [The Allure report](#the-allure-report)
5. [The failure screenshot](#the-failure-screenshot)
6. [Reading a mobile failure](#reading-a-mobile-failure)
7. [The report you hand back](#the-report-you-hand-back)

---

## Running the suite

```bash
npm run test:ios        # Safari on the iPhone 17 simulator
npm run test:android    # Chrome on the Samsung Galaxy S25 emulator
npm run test:both       # Android first, then iOS
npm run typecheck       # tsc --noEmit
```

Both platform runs share the spec glob, the Mocha options, the reporters, the Appium service and the failure handling; they differ only in the capabilities.

Before the first run of a session, the host needs the Appium drivers and a running device:

```bash
appium driver install xcuitest
appium driver install uiautomator2
```

The framework starts and stops the Appium server itself. Set `WDIO_APPIUM_SERVICE=false` to attach to a server that is already running — the usual arrangement in CI.

---

## Running one spec

The `--spec` flag takes a path relative to the repository root:

```bash
npm run test:ios -- --spec tests-mobile/auth/login.spec.ts
npm run test:android -- --spec tests-mobile/mobile/mobile-web.spec.ts
```

Several specs at once:

```bash
npm run test:ios -- --spec tests-mobile/auth/login.spec.ts --spec tests-mobile/dashboard/dashboard.spec.ts
```

The repository is ESM, so a spec cannot be run through `tsx` or `ts-node` on its own — it needs the WebdriverIO runner, which loads the spec through its own transform pipeline.

---

## Running by tag

Tags live inside the Mocha title, so they are selected with `--mochaOpts.grep`:

```bash
npm run test:smoke:ios                                    # the @smoke set
npm run test:ios -- --mochaOpts.grep "@smoke"
npm run test:ios -- --mochaOpts.grep "@regression"
npm run test:ios -- --mochaOpts.grep "@feature:auth"
npm run test:ios -- --mochaOpts.grep "@smoke|@sanity"     # several tags
```

The smoke scripts are already defined in `package.json`:

```json
"test:smoke:ios": "wdio run wdio.ios.conf.ts --mochaOpts.grep @smoke",
"test:smoke:android": "wdio run wdio.android.conf.ts --mochaOpts.grep @smoke"
```

Feature gating needs no flag: it happens automatically from `config/test-policy.json` for whichever `TEST_ENV` is configured.

---

## The Allure report

The reporter stack is `spec` (a readable console log) plus `allure`:

```ts
reporters: ['spec', ['allure', { outputDir: allureResultsDir, clean: true }]],
```

The raw results land in `allure-results/`, one JSON file per test. The report itself is generated from them:

```bash
npm run allure:generate    # allure generate allure-results --clean -o allure-report
npm run allure:open        # allure open allure-report
npm run allure:serve       # allure serve allure-results
```

- **`allure:generate`** builds the static report into `allure-report/` and replaces whatever was there (`--clean`).
- **`allure:open`** opens the generated report in a browser.
- **`allure:serve`** serves the raw results directly, regenerating as the run proceeds. It is the right command when the results are still being written.

The report title comes from `.allurerc.ts`:

```ts
export default {
    name: 'Shipmondo mobile-web (WebdriverIO + Appium 2)',
    clean: true,
    reportTitle: process.env.REPORT_TITLE ?? 'Shipmondo Mobile-Web Test Report',
};
```

`REPORT_TITLE` is the same variable the console banner uses, so the banner and the report agree.

The Allure command line needs Java on the `PATH`. Without it, `allure:generate` fails with a JVM error while the test run itself still succeeds — the results are already on disk.

---

## The failure screenshot

The shared config captures a screenshot of the phone for every failing test:

```ts
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
```

Three details matter:

- **It only runs on failure.** The `context.error` check means passing tests cost nothing.
- **The file name is sanitised.** `screenshotName()` replaces every character outside `[a-zA-Z0-9._-]` with an underscore, collapses runs of underscores, trims the ends and caps the length at 120 characters — so the name is valid on every platform and carries the ticket prefix and the description.
- **A failure to capture never fails the test.** The `try`/`catch` around `browser.saveScreenshot()` is deliberate: a diagnostic aid must never turn a passing test red or mask the original failure.

The file is written into `allure-results/` next to the test's result JSON, so the Allure report picks it up as an attachment.

---

## Reading a mobile failure

A mobile failure reads differently from a desktop one. Work through it in this order.

**1. Read the message, not the stack.** The `expect(value, message)` adapter puts the diagnostic message above the Jest failure, so the message is the first thing to read. *"the signed-in account name is not shown anywhere in the header"* is a diagnosis; *"expected 'undefined' to be truthy"* is not.

**2. Open the screenshot.** It is in `allure-results/` and is attached to the failed test in the report. It shows what the phone actually displayed, which is often the whole answer: the drawer still closed, the keyboard over the submit button, the account name hidden behind the avatar.

**3. Check the route.** Most mobile failures are a navigation failure: the drawer was not opened, the group was not expanded, or the previous route's DOM was still in place. Look at the URL in the failure and at the screenshot.

**4. Check the timing.** If the screenshot shows a spinner or a half-rendered list, the wait was too short or too generic. If it shows the finished UI and the assertion still failed, the wait is not the problem — the expectation is.

**5. Check the selector.** A selector that fails on one platform but not the other is usually a CSS `:has()`, a `:first-child` assumption about the double-rendered table, or the checkbox column. The XPath helpers in `src/mobile/selectors.ts` exist precisely because of this.

**6. Check the tenant.** The demo tenant is live. A test that hardcodes a row count, a shipment id or an order number will fail the day the tenant changes. Compare against the endpoint instead.

### The common failure signatures

| Symptom in the report | Likely cause |
|---|---|
| The element "exists" but the test cannot tap it | The element is behind the software keyboard — scroll it into view first |
| The tap does nothing | The navigation drawer is closed; the link is off-canvas but still "displayed" |
| The tap does nothing | The owning navigation group is collapsed — expand it outermost first |
| The screenshot shows the drawer open over the content | The test asserted against content while the drawer covered it |
| The account name is `undefined` | The header is condensed — read it through the profile dropdown |
| The list is empty | The route-scoped ready selector matched the *previous* route's table |
| The request returned 403 | `X-Requested-With: XMLHttpRequest` was not set |
| The request returned 500 | The DataTables query envelope was incomplete |
| The test is skipped | The feature is disabled for the current `TEST_ENV` — the reason is in the test title |
| The run failed during collection | A feature tag is not declared in `config/test-policy.json` |

---

## The report you hand back

After implementing or changing tests, report:

- the files created or modified, with their paths;
- the tests written, with their ticket titles and their feature and selection tags;
- the commands that were run and their outcome (`npm run typecheck`, the targeted spec on each device);
- the Allure report location and how to open it;
- any environment variable a new run needs;
- anything that was left out and why.

A report that says "the tests pass" without saying **on which device** is not a complete report. A case that passes on the iPhone and fails on the Galaxy is a defect, and this suite exists to find exactly that.
