/**
 * Test data generation utilities.
 *
 * Always use a prefix matching your test type (mobile, ui, smoke, ...) so
 * created data is traceable in logs and in the Shipmondo backend.
 */

const randomSuffix = (): string => Math.random().toString(36).substring(2, 10);

/** Unique email, e.g. `mobile-1712345678-ab12cd34@test.com`. */
export function uniqueEmail(prefix = 'mobile'): string {
    return `${prefix}-${Date.now()}-${randomSuffix()}@test.com`;
}

/** Unique username / reference, e.g. `mobile_1712345678_ab12cd34`. */
export function uniqueUsername(prefix = 'mobile'): string {
    return `${prefix}_${Date.now()}_${randomSuffix()}`;
}

/** Unique identifier with a dash separator, e.g. `test-1712345678-ab12cd34`. */
export function uniqueId(prefix = 'test'): string {
    return `${prefix}-${Date.now()}-${randomSuffix()}`;
}

/**
 * Unique reference string usable as an order id or shipment reference.
 * Shipmondo order ids are numeric strings, so this returns digits only.
 */
export function uniqueOrderId(): string {
    return String(Date.now()).slice(-9) + Math.floor(Math.random() * 1000);
}

/**
 * Picks a random element of a non-empty array.
 * @throws if the array is empty — never return undefined silently.
 */
export function pickRandom<T>(items: readonly T[]): T {
    if (items.length === 0) {
        throw new Error('pickRandom called with an empty array.');
    }
    return items[Math.floor(Math.random() * items.length)];
}
