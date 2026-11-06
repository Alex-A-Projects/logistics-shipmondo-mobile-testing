/**
 * Filesystem locations used by the framework.
 *
 * The project is ESM, so `__dirname` is not available. The root is resolved
 * from `process.env.PROJECT_ROOT` when set, and otherwise from the working
 * directory the runner was started in (WebdriverIO always starts at the
 * repository root).
 */
import path from 'path';
import { projectRoot } from './env';

export const Paths = {
    /** Absolute path of the repository root. */
    repoRoot: projectRoot,
    /** `config/` — the policy matrix and the device matrix. */
    configDir: path.join(projectRoot, 'config'),
    /** The feature-gating matrix. */
    testPolicyFile: path.join(projectRoot, 'config', 'test-policy.json'),
    /** The device matrix. */
    devicesFile: path.join(projectRoot, 'config', 'devices.ts'),
    /** Local `.env` with credentials and endpoints. */
    rootEnvFile: path.join(projectRoot, '.env'),
    /** Page/component/service sources. */
    srcDir: path.join(projectRoot, 'src'),
    /** Mobile sources (POMs, components, services, fixtures). */
    mobileDir: path.join(projectRoot, 'src', 'mobile'),
    /** The mobile-web spec tree. */
    testsDir: path.join(projectRoot, 'tests-mobile'),
    /** Raw Allure results — one JSON file per test. */
    allureResultsDir: path.join(projectRoot, 'allure-results'),
    /** Generated Allure report. */
    allureReportDir: path.join(projectRoot, 'allure-report'),
    /** Screenshots captured on failure land here. */
    screenshotsDir: path.join(projectRoot, 'allure-results', 'screenshots'),
} as const;
