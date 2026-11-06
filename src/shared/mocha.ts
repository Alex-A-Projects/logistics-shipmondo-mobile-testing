/**
 * Mocha helpers with **definition-time** feature gating.
 *
 * Why not a runtime fixture? Because a runtime fixture would only discover
 * the problem after the browser was already on the device — the run would
 * spend minutes on a device before failing on a typo in a feature tag.
 * Gating at definition time means an undeclared feature fails in the first
 * second, before any session is created.
 *
 * Semantics:
 *
 *  - Feature tag **not declared** in `config/test-policy.json`
 *      → the suite throws during collection → the run fails loudly.
 *  - Feature tag **declared but disabled** for the current env
 *      → the test is skipped with an explanatory reason.
 *  - Feature tag **declared and enabled**
 *      → the test runs normally.
 *
 * Tags travel inside the Mocha title (WebdriverIO has no native tag
 * support), so `--mochaOpts.grep "@smoke"` still works.
 *
 * `describe` / `it` / `beforeEach` are the **ambient Mocha globals** — they
 * are installed on `globalThis` by Mocha's BDD interface and wrapped by
 * WebdriverIO's Mocha framework, which is what triggers the `beforeTest` /
 * `afterTest` hooks of the runner. They are deliberately *not* imported:
 * `@wdio/globals` does not export them, and Mocha's own ESM exports resolve
 * against a context that only exists once a file is being loaded — importing
 * them would break at module-evaluation time.
 */
import { policy } from './policy';
import { featureNameOf } from './tags';

/** Options accepted by the mobile `describe` / `it` helpers. */
export interface MobileTestOptions {
    /** Feature tags, e.g. `featureTag('auth')`. */
    features?: readonly string[];
    /** Suite / selection tags, e.g. `Tags.SMOKE`. */
    tags?: readonly string[];
}

const featureNames = (options: MobileTestOptions): string[] =>
    (options.features ?? [])
        .map((tag) => featureNameOf(tag))
        .filter((name): name is string => Boolean(name));

/**
 * Verifies the requested features and returns the reason to skip, if any.
 *
 * @throws when a feature is not declared for the current env.
 */
export function resolveFeatureGate(options: MobileTestOptions): string | undefined {
    const names = featureNames(options);
    const undeclared = names.filter((name) => !policy.isDeclared(name));
    if (undeclared.length > 0) {
        throw new Error(
            `Feature tag(s) not declared in config/test-policy.json for env "${process.env.TEST_ENV ?? 'demo'}": ` +
                `${undeclared.join(', ')}. ` +
                `Declared features: ${policy.declaredFeatures().join(', ')}. ` +
                'A typo in a feature tag must fail the run, not silently skip the test.',
        );
    }
    const disabled = names.filter((name) => !policy.isEnabled(name));
    if (disabled.length > 0) {
        return disabled.map((name) => policy.skipReason(name)).join(' ');
    }
    return undefined;
}

/**
 * Builds the Mocha title, appending the tags in a stable order so a grep
 * matches predictably.
 */
export function buildTitle(description: string, options: MobileTestOptions): string {
    const tags = [...(options.tags ?? [])].sort();
    return tags.length > 0 ? `${description} ${tags.join(' ')}` : description;
}

/**
 * `describe` wrapper that validates the feature tags of the whole suite.
 *
 * Throwing here aborts collection of the file, which WebdriverIO surfaces as
 * a failed spec file — the desired "fail loudly" behaviour.
 */
export function describeMobile(
    description: string,
    options: MobileTestOptions,
    body: () => void,
): void {
    resolveFeatureGate(options);
    describe(buildTitle(description, options), body);
}

/**
 * `it` wrapper that skips the test when its feature is disabled for the
 * current env, and fails loudly when the feature is unknown.
 */
export function itMobile(
    description: string,
    options: MobileTestOptions,
    body: () => unknown,
): void {
    const skipReason = resolveFeatureGate(options);
    const fullTitle = buildTitle(description, options);
    if (skipReason) {
        it.skip(fullTitle, body);
        return;
    }
    it(fullTitle, body);
}
