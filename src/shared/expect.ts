import { expect as baseExpect } from 'expect-webdriverio';

/**
 * `expect` with an optional diagnostic message.
 *
 * Why this module exists
 * ----------------------
 * Playwright's `expect` takes a **second** argument — `expect(value, 'message')`
 * — and prints the message above the failure. WebdriverIO's `expect` is
 * Jest's, which accepts exactly one argument and throws
 * `Expect takes at most one argument.` for a second one.
 *
 * That is a *runtime* difference, not a typing detail, so a Playwright suite
 * cannot simply be re-typed for WebdriverIO: every `expect(value, 'message')`
 * has to be given an equivalent. Dropping the messages would work but would
 * throw away the context that makes a mobile failure readable — on a phone,
 * "expected 'undefined' to be truthy" says far less than "the signed-in
 * account name is not shown anywhere in the header".
 *
 * This module is that equivalent. `expect(value, 'message')`:
 *
 *  - behaves **exactly** like `expect(value)` while the assertion passes, and
 *  - reports `message` together with the original Jest failure (diff included)
 *    when it does not.
 *
 * The matcher surface is WebdriverIO's own, so the WebdriverIO matchers
 * (`toBeDisplayed()`, `toBeExisting()`, …) and the asymmetric matchers
 * (`expect.anything()`) are available unchanged.
 *
 * @example
 * // The Playwright idiom, unchanged:
 * expect(name, 'the account name is missing from the header').toBeTruthy();
 *
 * // The same, without a message — the plain WebdriverIO call:
 * expect(name).toBeTruthy();
 */

/**
 * The matcher surface of an expectation.
 *
 * Mirrors WebdriverIO's own typing: an element (a `PromiseLike`) also gets
 * the promise matchers, such as `toBeDisplayed()`.
 */
export type Expectation<T> = T extends PromiseLike<unknown>
    ? ExpectWebdriverIO.MatchersAndInverse<void, T> & ExpectWebdriverIO.PromiseMatchers<T>
    : ExpectWebdriverIO.MatchersAndInverse<void, T>;

/** True for a value that can be awaited. */
function isThenable(value: unknown): value is PromiseLike<unknown> {
    return (
        typeof value === 'object' &&
        value !== null &&
        typeof (value as { then?: unknown }).then === 'function'
    );
}

/**
 * Prefixes a failure with the diagnostic message of the assertion.
 *
 * The original error object is kept — only its message is extended — so the
 * report still carries the Jest diff and the original error class.
 */
function annotate(error: unknown, message: string): unknown {
    if (error instanceof Error) {
        error.message = `${message}\n\n${error.message}`;
        return error;
    }
    return error;
}

/**
 * Wraps every matcher of an expectation so that a failure carries the
 * diagnostic message.
 *
 * The matchers are reached through a proxy rather than by copying them, so a
 * matcher that WebdriverIO adds later is wrapped as well. The sub-objects
 * (`not`, `resolves`, `rejects`) are wrapped recursively.
 */
function withMessage(target: object, message: string): object {
    return new Proxy(target, {
        get(object, property, receiver) {
            const value = Reflect.get(object, property, receiver);

            if (typeof value === 'function') {
                return (...args: unknown[]) => {
                    try {
                        const result = (value as (...a: unknown[]) => unknown).apply(object, args);
                        // An async matcher (`toBeDisplayed()` and friends)
                        // reports its failure by rejecting.
                        return isThenable(result)
                            ? result.then(undefined, (error: unknown) => {
                                  throw annotate(error, message);
                              })
                            : result;
                    } catch (error) {
                        throw annotate(error, message);
                    }
                };
            }

            if (typeof value === 'object' && value !== null) {
                return withMessage(value, message);
            }

            return value;
        },
    });
}

/**
 * The suite's `expect`.
 *
 * A proxy over WebdriverIO's `expect`, so the asymmetric matchers and the
 * WebdriverIO matchers keep working exactly as they do upstream.
 */
export const expect = new Proxy(baseExpect, {
    apply(target, thisArg, argumentsList) {
        const [actual, message] = argumentsList as [unknown, string | undefined];
        if (argumentsList.length > 2) {
            // More than a value and a message — let the underlying `expect`
            // report the mistake instead of quietly dropping an argument.
            return Reflect.apply(target, thisArg, argumentsList);
        }
        const expectation = Reflect.apply(target, thisArg, [actual]);
        return message ? withMessage(expectation, message) : expectation;
    },
}) as unknown as (<T>(actual: T, message?: string) => Expectation<T>) &
    ExpectWebdriverIO.Expect;
