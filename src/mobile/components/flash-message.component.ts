import { browser } from '@wdio/globals';
import { BaseComponent } from './base.component';

/**
 * Flash / notification messages shown by the Shipmondo app after an action.
 *
 * The app uses Bootstrap alert markup:
 *   .alert.alert-success  — action succeeded
 *   .alert.alert-danger   — action failed
 *   .alert.alert-warning  — the standing "You are entering a demo
 *                            environment." notice (not a flash)
 *
 * The warning variant is therefore excluded from the general lookup so a
 * demo notice is never mistaken for the result of an action.
 *
 * `text()` — inherited from the base component — is the text of that first
 * flash, or `undefined` when no flash is rendered.
 */
export class FlashMessageComponent extends BaseComponent {
    protected get root() {
        return browser.$('.alert:not(.alert-warning)');
    }

    /** Success-class flash. */
    async success() {
        return browser.$('.alert-success');
    }

    /** Error-class flash. */
    async error() {
        return browser.$('.alert-danger');
    }
}
