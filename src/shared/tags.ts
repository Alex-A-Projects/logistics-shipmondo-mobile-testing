/**
 * Suite / selection tags — chosen at the CLI, never gated by the policy file.
 *
 * WebdriverIO has no native tag support, so tags are carried inside the test
 * title (Mocha's `--grep` filters on it). Example:
 *
 * ```bash
 * npx wdio run wdio.ios.conf.ts --spec tests-mobile/auth/login.spec.ts --mochaOpts.grep "@smoke"
 * ```
 *
 * The *feature* axis (`@feature:<name>`) is separate — see `featureTag`.
 */

/** Selection / suite tags. */
export const Tags = {
    SMOKE: '@smoke',
    SANITY: '@sanity',
    REGRESSION: '@regression',
    NEGATIVE: '@negative',
    BOUNDARY: '@boundary',
    E2E: '@e2e',
    SECURITY: '@security',
    ACCESSIBILITY: '@accessibility',
    CRITICAL: '@critical',
    /** Mobile-web suite. */
    MOBILE: '@mobile',
    /** UI suite only. */
    UI: '@ui',
    /** API suite only. */
    API: '@api',
    /** DB suite only. */
    DB: '@db',
    /** Shipment booking / labels. */
    SHIPMENT: '@shipment',
    /** Sales order management. */
    ORDER: '@order',
    /** Address book / parties. */
    ADDRESS: '@address',
    /** Webhooks. */
    WEBHOOK: '@webhook',
    /** Catalogue: products, carriers, printers. */
    CATALOG: '@catalog',
    /** Authentication and account. */
    AUTH: '@auth',
    /** Mobile layout / responsive behaviour. */
    RESPONSIVE: '@responsive',
} as const;

/** Prefix of the feature-gating axis. */
export const FEATURE_PREFIX = '@feature:';

/**
 * Builds a feature tag.
 *
 * The feature name MUST exist in `config/test-policy.json` for the current
 * env. An undeclared feature fails the run loudly (a typo must never quietly
 * disable a test); a declared-but-disabled feature skips the test.
 */
export const featureTag = (name: string): string => `${FEATURE_PREFIX}${name}`;

/** Every suite tag in one list — used by the "has a suite tag" quality rule. */
export const SUITE_TAGS: readonly string[] = [
    Tags.SMOKE,
    Tags.SANITY,
    Tags.REGRESSION,
    Tags.NEGATIVE,
    Tags.BOUNDARY,
    Tags.E2E,
    Tags.SECURITY,
    Tags.ACCESSIBILITY,
    Tags.CRITICAL,
    Tags.MOBILE,
    Tags.UI,
    Tags.API,
    Tags.DB,
];

/** Extracts the feature name from a feature tag, if the tag is one. */
export function featureNameOf(tag: string): string | undefined {
    return tag.startsWith(FEATURE_PREFIX) ? tag.slice(FEATURE_PREFIX.length) : undefined;
}

/** True when the tag list contains at least one suite tag. */
export function hasSuiteTag(tags: readonly string[]): boolean {
    return tags.some((tag) => SUITE_TAGS.includes(tag));
}
