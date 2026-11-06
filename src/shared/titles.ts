import { TICKET_PREFIX } from './env';

/**
 * Formats a test title so a failure maps back to a ticket:
 * `SHIP-3001 | what is verified`.
 *
 * @param ticketNumber the numeric ticket id (e.g. 3001)
 * @param description what the test verifies
 * @param prefix optional override of the configured ticket prefix
 */
export function title(
    ticketNumber: number | string,
    description: string,
    prefix = TICKET_PREFIX,
): string {
    return `${prefix}-${ticketNumber} | ${description}`;
}
