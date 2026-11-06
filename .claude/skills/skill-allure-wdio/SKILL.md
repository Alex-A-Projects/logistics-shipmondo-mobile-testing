---
name: skill-allure-wdio
description: "Add or improve Allure reporting in the Shipmondo mobile-web suite — WebdriverIO v9 with @wdio/allure-reporter, allure-commandline, .allurerc.ts and the allure-results/ output directory. Covers the reporter options in wdio.shared.conf.ts, the ALLURE_* environment variables and the .env variables Allure reads, the afterTest hook that captures the failure screenshot, the annotation API (labels, steps, links, attachments) and how to read the report. Use when asked to annotate the mobile specs with Allure, improve the Allure report, or add steps, metadata or attachments."
disable-model-invocation: false
---

You are a senior mobile UI automation engineer. Given `$ARGUMENTS` (a spec file, an area, or "all"), instrument the mobile-web specs with Allure annotations following the rules below.

The reporting stack in this repository is:

```
@wdio/allure-reporter        writes the raw results
        ↓
allure-results/               one JSON file per test, plus the attachments
        ↓  allure generate
allure-report/                the static HTML report
```

---

## Step 1 — Orient

1. Read `package.json` and confirm `@wdio/allure-reporter` and `allure-commandline` are in `dependencies`.
2. Read `wdio.shared.conf.ts` and find the reporter entry.
3. Read `.allurerc.ts`.
4. Check whether the npm scripts `allure:generate`, `allure:open` and `allure:serve` exist.

The current state of all four:

**`package.json`**

```json
"scripts": {
  "allure:generate": "allure generate allure-results --clean -o allure-report",
  "allure:open": "allure open allure-report",
  "allure:serve": "allure serve allure-results"
}
```

**`wdio.shared.conf.ts`**

```ts
/** Where the raw Allure results are written. */
export const allureResultsDir = path.join(projectRoot, 'allure-results');

reporters: ['spec', ['allure', { outputDir: allureResultsDir, clean: true }]],
```

**`.allurerc.ts`**

```ts
export default {
    name: 'Shipmondo mobile-web (WebdriverIO + Appium 2)',
    clean: true,
    reportTitle: process.env.REPORT_TITLE ?? 'Shipmondo Mobile-Web Test Report',
};
```

**`src/shared/paths.ts`** resolves the two directories the report uses:

```ts
allureResultsDir: path.join(projectRoot, 'allure-results'),
allureReportDir: path.join(projectRoot, 'allure-report'),
```

---

## Step 2 — The reporter options

The reporter is registered by name — `'allure'` resolves to `@wdio/allure-reporter` — with two options set:

| Option | Value | Why |
|---|---|---|
| `outputDir` | `allureResultsDir` | The raw results land next to the repo root, where `allure generate` expects them. |
| `clean` | `true` | Every run starts from an empty results directory, so a stale result from a previous run can never be reported as a pass. |

The `spec` reporter runs alongside it and prints a readable console log. Both are needed: the console log is what a developer watches during a run, the Allure report is what a team reads afterwards.

### The options that are available

`@wdio/allure-reporter` accepts more than the two in use:

| Option | Default | Use it when |
|---|---|---|
| `outputDir` | `./allure-results` | Always set it explicitly. |
| `clean` | `false` | Set it to `true` — a stale result is worse than no result. |
| `addConsoleLogs` | `false` | The browser console output should be attached to the report. Useful for a mobile failure, where the page often logs the reason it did not repaint. |
| `reportedEnvironmentVars` | — | A map of variables to display on the report's environment page. |
| `issueLinkTemplate` | — | A pattern such as `https://tracker.example/browse/{}`; the reporter replaces `{}` with the id passed to `addIssue()`. |
| `tmsLinkTemplate` | — | The same, for the test-management ids passed to `addTestId()`. |
| `disableWebdriverStepsReporting` | `false` | Set it to `true` when the raw WebDriver command stream drowns the useful steps. |
| `disableWebdriverScreenshotsReporting` | `false` | Set it to `true` when the reporter's own screenshot duplicates the one the `afterTest` hook takes. |
| `disableMochaHooks` | `false` | Set it to `true` to keep the `before`/`after` hooks out of the report. |
| `includeVersionInHistoryId` | `false` | Set it to `true` when the same test runs against several OS versions and the history trends should stay separate. |

The recommended configuration for this suite, if the reporter is to be extended:

```ts
reporters: [
    'spec',
    [
        'allure',
        {
            outputDir: allureResultsDir,
            clean: true,
            addConsoleLogs: true,
            reportedEnvironmentVars: {
                'Test environment': env.testEnv,
                'Base URL': env.baseURL,
                'Report title': env.reportTitle,
            },
            issueLinkTemplate: 'https://tracker.example/browse/{}',
        },
    ],
],
```

`reportedEnvironmentVars` displays the variables on the report's **Environment** page. It does not set them. Only variables that are safe to publish belong there — never a credential, never a session cookie.

---

## Step 3 — The environment variables

### `ALLURE_*`

| Variable | Read by | Effect |
|---|---|---|
| `ALLURE_TESTPLAN_PATH` | `@wdio/allure-reporter` | Path to a testplan file. When it is set, the reporter reads the plan and **skips** the tests that are not in it, marking them with the `ALLURE_TESTPLAN_SKIP` label. |
| `ALLURE_HOME` | `allure-commandline` | The Allure installation directory the command line reads its configuration from. |
| `ALLURE_NO_ANALYTICS` | `allure-commandline` | Disables the command line's usage reporting. |
| `ALLURE_IDEA_ENABLED`, `ALLURE_IDEA_PORT` | `allure-commandline` | Controls the IDE integration listener. |

`ALLURE_TESTPLAN_PATH` is the one that changes what runs. Set it in CI to run only the cases a testplan selects:

```bash
ALLURE_TESTPLAN_PATH=./testplan.json npm run test:ios
```

### The `.env` variables Allure reads

Allure itself reads no `.env` file. The link between the two is the project's own configuration:

| Variable | Read by | Effect |
|---|---|---|
| `REPORT_TITLE` | `.allurerc.ts` and `src/shared/env.ts` | The title of the generated report, and the title of the console banner. The two agree because both fall back to `Shipmondo Mobile-Web Test Report`. |
| `TEST_ENV` | `src/shared/env.ts` | The tenant under test. Worth putting on the report's Environment page so a report is self-describing. |
| `APPIUM_LOG_LEVEL` | `wdio.shared.conf.ts` | The Appium server's log level. `debug` produces a lot of output; keep it at `info` for a normal run. |

`REPORT_TITLE` is the one to set in CI, so the published report says which build it belongs to:

```bash
REPORT_TITLE="Shipmondo mobile-web — build ${CI_COMMIT_SHORT_SHA}" npm run allure:generate
```

---

## Step 4 — The failure screenshot

The shared config captures a screenshot of the phone for every failing test and writes it into the results directory, where the report picks it up as an attachment:

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

Four properties to preserve if this hook is ever changed:

1. **It only runs on failure.** The `context.error` check means passing tests cost nothing.
2. **The name is sanitised.** `screenshotName()` keeps `[a-zA-Z0-9._-]`, collapses runs of underscores, trims the ends and caps the length at 120 characters. The name therefore carries the ticket prefix and the description and is valid as a file name on every platform.
3. **A capture failure never fails the test.** The `try`/`catch` is deliberate.
4. **The screenshot goes next to the result JSON**, into `allure-results/`, so the report attaches it to the right test.

Note that the `afterTest` hook is a **runner** hook, not a Mocha hook: it runs once per test, after the test has finished, and it sees the test's error through `context.error`.

---

## Step 5 — Annotating the specs

### The import

```ts
import {
    addEpic,
    addFeature,
    addStory,
    addSuite,
    addLabel,
    addTag,
    addOwner,
    addSeverity,
    addIssue,
    addTestId,
    addLink,
    addDescription,
    addStep,
    step,
    addAttachment,
    addArgument,
} from '@wdio/allure-reporter';
```

These are the reporter's own exported functions. `@wdio/allure-reporter` re-exports them from its `common/api` module, so a spec needs no second dependency.

> Allure imports live in **spec files only**. Never in a page object, a component, a service or a fixture — the annotations describe the scenario, and the scenario belongs to the spec.

### Metadata

Call the metadata functions **at the top of the test body**, before any `await` on the app, so they are captured even if the test fails immediately.

| Function | Example |
|---|---|
| `addEpic(name)` | `await addEpic('Shipmondo mobile web')` |
| `addFeature(name)` | `await addFeature('Shipments list')` |
| `addStory(name)` | `await addStory('A warehouse operator opens the shipments list')` |
| `addParentSuite(name)` | `await addParentSuite('UI')` |
| `addSuite(name)` | `await addSuite('Booked shipments')` |
| `addSubSuite(name)` | `await addSubSuite('Regression')` |
| `addOwner(name)` | `await addOwner('qa-team')` |
| `addSeverity(level)` | `await addSeverity('critical')` |
| `addTag(tag)` | `await addTag('smoke')` |
| `addDescription(text, type?)` | `await addDescription('Verifies the list renders.', 'markdown')` |
| `addIssue(id)` | `await addIssue('SHIP-3204')` |
| `addTestId(id)` | `await addTestId('SHIP-3204')` |
| `addLink(url, name?, type?)` | `await addLink('https://tracker.example/browse/SHIP-3204', 'SHIP-3204')` |
| `addArgument(name, value)` | `await addArgument('environment', env.testEnv)` |

The severity values Allure recognises are `blocker`, `critical`, `normal`, `minor` and `trivial`. The description type is `'text'`, `'html'` or `'markdown'`.

`addIssue()` and `addTestId()` take the **bare id** — `SHIP-3204`, not a URL — when the reporter has an `issueLinkTemplate` or a `tmsLinkTemplate` configured; the reporter builds the link. When there is no template, pass the full URL.

### The labels that come for free

The reporter derives labels from the runner itself, without any code in the spec:

- the **suite** structure from the `describe` blocks;
- the **package** and **test framework** from the runner;
- the **history id** from the test title and the device family, so the trends survive a Chrome or an OS update;
- the **parameters** from the capabilities.

### Steps

Two ways to write a step.

**`step()` — a nested block.** It is the readable form: the body is a normal function and the nesting is implicit.

```ts
await step('Open the navigation drawer', async () => {
    await app.components.sidebar.openDrawer();
});

await step('Navigate to the shipments list', async () => {
    await app.components.sidebar.navigateTo('Shipments');
});
```

**`addStep()` — a flat entry.** The title, an optional attachment and an optional status.

```ts
await addStep('The drawer is open');
```

A step should describe **what the user is doing**, not the implementation detail. "Navigate to the shipments list", not "call `navigateTo('Shipments')`". The page object encapsulates the interaction; the step describes the scenario.

Do not use `step()` as a substitute for a page-object method. If a step contains a selector, the selector belongs in the POM layer.

### Attachments

```ts
// Inline content
await addAttachment(
    'The rendered shipment rows',
    JSON.stringify(await app.pages.shipments.visibleShipmentIds(), null, 2),
    'application/json',
);

// A file already on disk — for example the screenshot the afterTest hook took
await addAttachment('Screenshot', await readScreenshot(), 'image/png');
```

The third argument is the MIME type. Attachments are visible in the report next to the step that produced them.

**Never attach a secret.** Not the password, not the session cookie, not an API key. The API-access endpoints return metadata only, so those rows are safe; the credentials and the captured session are not.

### Arguments

```ts
await addArgument('environment', env.testEnv);
await addArgument('device', ANDROID_DEVICE.deviceName);
```

Arguments are shown as test parameters in the report and feed the history id. Keep them to values that identify the run, not values that identify the account.

---

## Step 6 — Integration rules

- **Allure calls live in spec files only.**
- **Metadata first.** Call `addEpic`, `addFeature`, `addSeverity` and `addOwner` before the first `await` on the app.
- **Steps describe the scenario**, not the code.
- **The ticket prefix is the id.** `addIssue('SHIP-3204')` and `addTestId('SHIP-3204')` match the `title()` prefix, so a report entry links back to the ticket.
- **The existing spec conventions already produce a good report.** The Mocha title carries the ticket prefix and the tags, and the `describe` blocks become the suite hierarchy. Annotations add the metadata the runner cannot infer — the epic, the severity, the owner.
- **Do not duplicate what the reporter already derives.** The suite name, the package and the parameters are automatic; annotating them again is noise.

---

## Step 7 — Verify

```bash
npm run test:ios            # writes allure-results/
npm run allure:serve        # serves the results and regenerates live
```

Then check:

- `allure-results/` is populated — one `*-result.json` per test;
- a failed test has a screenshot attached, and the attachment shows what the phone displayed;
- the suite hierarchy mirrors the `describeMobile` blocks;
- the test titles carry the `SHIP-<number> |` prefix;
- the Environment page shows the environment and the base URL;
- no credential appears anywhere in the report or in `allure-results/`.

For a static report to publish:

```bash
npm run allure:generate     # allure-report/
npm run allure:open
```

The Allure command line needs Java on the `PATH`. Without it the generation fails while the test run itself still succeeds — the raw results are already on disk.

---

## Step 8 — Report

List:

- every spec file annotated, with its path;
- the labels added — epic, feature, story, suite, severity, owner, tags;
- the steps and the attachments added;
- the reporter options and the environment variables changed;
- the commands to open the report.
