import { expect } from './expect';

/**
 * Failure-collection assertion pattern.
 *
 * When a test verifies several independent things, collecting the failures and
 * asserting once at the end means the report shows EVERY problem, not just
 * the first one.
 *
 * @example
 * const failed = await collectFailures({
 *   'dashboard tile': async () => expect(await tiles.count()).toBeGreaterThan(0),
 *   'sidebar':        async () => expect(await links.isDisplayed()).toBe(true),
 * });
 * expectNoFailures(failed, 'the dashboard is incomplete');
 */
export async function collectFailures(
    checks: Record<string, () => Promise<void>>,
): Promise<string[]> {
    const failed: string[] = [];
    for (const [name, check] of Object.entries(checks)) {
        try {
            await check();
        } catch {
            failed.push(name);
        }
    }
    return failed;
}

/**
 * Asserts that a {@link collectFailures} run produced no failures.
 *
 * The failure names are part of the message, so the report says *which*
 * checks failed rather than only that "something" failed.
 *
 * @param failed the names of the failed checks
 * @param summary what the group of checks was about
 */
export function expectNoFailures(failed: string[], summary: string): void {
    expect(failed, summary).toEqual([]);
}
