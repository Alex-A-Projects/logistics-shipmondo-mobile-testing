import { browser } from '@wdio/globals';
import { BasePage } from './base.page';
import {
    LOGIN_EMAIL,
    LOGIN_EMAIL_ERROR,
    LOGIN_ERROR,
    LOGIN_PASSWORD,
    LOGIN_PASSWORD_ERROR,
    LOGIN_REMEMBER_ME,
    LOGIN_SUBMIT,
} from '../selectors';

/**
 * The Shipmondo login page.
 *
 * DOM (verified): Rails form with `#user_email`, `#user_password`,
 * `#user_remember_me` and an `input[type=submit]` labelled "Log in".
 * The `email` query parameter pre-fills the address.
 *
 * The page carries a standing `.alert.alert-warning` notice ("You are
 * entering a demo environment."), so the failure message is matched by the
 * specific `.alert.alert-danger` variant.
 *
 * Server behaviour verified against the live app:
 *  - Wrong password  → the form POSTs, the page re-renders with
 *                       `.alert.alert-danger` ("The information entered is
 *                       not valid.") and the URL becomes `/account/login`.
 *  - Malformed email → the client-side validator blocks the POST: the URL
 *                       is unchanged, no `.alert` is rendered and
 *                       `#user_email-error` reads "Please fill in correct
 *                       e-mail".
 *  - Empty password → the same client-side block:
 *                       `#user_password-error` reads "Please fill in
 *                       password".
 *
 * The block is client-side, so **no request reaches the server** and no
 * `.alert-danger` appears. Only a wrong password produces a server rejection.
 *
 * Mobile adaptation
 * -----------------
 * The form is a plain HTML form, so nothing about it changes on a phone —
 * but the *typing* does. On a mobile browser the software keyboard covers
 * the lower half of the screen, and the submit button may sit behind it.
 * The submit therefore scrolls the button into view before tapping it, and
 * the password field is typed into through `setValue` (a single atomic
 * assignment) rather than key-by-key, which keeps the on-screen keyboard
 * from swallowing characters.
 */
export class LoginPage extends BasePage {
    protected readonly path = '/account/login?locale=en';
    protected readonly readySelector = LOGIN_EMAIL;

    /** The e-mail field. */
    async emailInput() {
        return browser.$(LOGIN_EMAIL);
    }

    /** The password field. */
    async passwordInput() {
        return browser.$(LOGIN_PASSWORD);
    }

    /** The "remember me" checkbox. */
    async rememberMeCheckbox() {
        return browser.$(LOGIN_REMEMBER_ME);
    }

    /** The submit button. */
    async submitButton() {
        return browser.$(LOGIN_SUBMIT);
    }

    /** Flash/validation error shown when the login is rejected. */
    async errorMessage() {
        return browser.$(LOGIN_ERROR);
    }

    /**
     * The client-side validation message for the e-mail field.
     *
     * The app renders it as `<em id="user_email-error" class="invalid">` —
     * an `em`, not an `.alert`, so it is matched by id.
     */
    async emailError() {
        return browser.$(LOGIN_EMAIL_ERROR);
    }

    /** The client-side validation message for the password field. */
    async passwordError() {
        return browser.$(LOGIN_PASSWORD_ERROR);
    }

    /**
     * Fills the credentials and submits the form.
     *
     * The submit does **not** wait for the resulting navigation: the demo
     * server can take several seconds to answer, and blocking on the
     * navigation burns the whole test budget on a single login. Callers wait
     * for the outcome they expect instead.
     */
    async login(email: string, password: string, rememberMe = false): Promise<void> {
        const emailField = await this.emailInput();
        await emailField.setValue(email);

        const passwordField = await this.passwordInput();
        await passwordField.setValue(password);

        if (rememberMe) {
            const checkbox = await this.rememberMeCheckbox();
            if (await checkbox.isExisting()) {
                await checkbox.click();
            }
        }

        await this.submit();
    }

    /**
     * Taps the submit button, scrolling it into view first.
     *
     * On a phone the software keyboard can cover the button; scrolling the
     * element to the centre of the viewport is what makes the tap land.
     */
    async submit(): Promise<void> {
        const button = await this.submitButton();
        await button.waitForDisplayed({ timeout: 10_000 });
        await browser.execute((selector: string) => {
            const element = document.querySelector(selector);
            if (element) {
                element.scrollIntoView({ block: 'center', inline: 'center' });
            }
        }, LOGIN_SUBMIT);
        await button.click();
    }

    /** The visible text of the error message, if any. */
    async errorText(): Promise<string | undefined> {
        const error = await this.errorMessage();
        if (!(await error.isExisting())) {
            return undefined;
        }
        return (await error.getText()).trim();
    }

    /**
     * True when the browser is on the login page.
     *
     * After a rejected sign-in the server redirects to `/account/login`
     * (with a trailing slash), so the check is a plain substring match.
     *
     * `browser.getUrl()` is a protocol call, so the check is asynchronous.
     */
    async isOnLoginRoute(): Promise<boolean> {
        return (await browser.getUrl()).includes('/account/login');
    }
}
