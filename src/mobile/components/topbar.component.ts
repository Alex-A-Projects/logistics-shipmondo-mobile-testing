import { browser } from '@wdio/globals';
import { BaseComponent } from './base.component';
import { ACCOUNT_NAME, ENVIRONMENT_BADGE, PROFILE_MENU } from '../selectors';

/**
 * The app's top bar — account menu, environment badge, sign out.
 *
 * Verified against the live demo app:
 *  - The signed-in name is rendered twice inside the profile dropdown —
 *    `.company-name` (the company) and `.user-name` (the contact). Only
 *    `.company-name` is visible for an owner.
 *  - The environment badge is `#logo-group .label` and reads "Demo" in the
 *    demo environment. It is rendered only in demo mode.
 *
 * Mobile adaptation
 * -----------------
 * On a phone the header is condensed: the account name is hidden behind the
 * profile avatar (`#mobile-profile-img`), which opens a dropdown. The
 * component therefore *opens the profile menu* before reading the account
 * name, and reads the name from the dropdown when the header itself does not
 * show it.
 */
export class TopbarComponent extends BaseComponent {
    protected get root() {
        return browser.$('#header');
    }

    /** The signed-in name shown in the header. */
    async userName() {
        return browser.$(ACCOUNT_NAME);
    }

    /** The profile dropdown trigger in the header. */
    async profileMenu() {
        return browser.$(PROFILE_MENU);
    }

    /** The environment badge (e.g. "Demo"). */
    async environmentBanner() {
        return browser.$(ENVIRONMENT_BADGE);
    }

    /**
     * Opens the profile dropdown.
     *
     * On a phone the avatar is the only way to reach the account menu, so
     * every account-related read goes through here.
     */
    async openProfileMenu(): Promise<void> {
        const trigger = await this.profileMenu();
        if (!(await trigger.isExisting())) {
            return;
        }
        if (await this.isProfileMenuOpen()) {
            return;
        }
        await trigger.click();
        await browser.waitUntil(
            async () => this.isProfileMenuOpen(),
            {
                timeout: 10_000,
                timeoutMsg: 'The profile menu did not open after tapping the avatar.',
                interval: 200,
            },
        );
    }

    /**
     * True when the profile dropdown is expanded.
     *
     * The dropdown is a sibling of the trigger rather than a child of it, so
     * its state is read from the DOM: an open dropdown contains the sign-out
     * link, a closed one does not.
     */
    async isProfileMenuOpen(): Promise<boolean> {
        return browser.execute(() => {
            const links = Array.from(document.querySelectorAll('a'));
            return links.some(
                (link) => (link.textContent ?? '').trim().toLowerCase() === 'sign out',
            );
        });
    }

    /**
     * The visible environment name, if a badge is present.
     *
     * The badge is only rendered in demo mode, so it is absent elsewhere and
     * the method returns `undefined` rather than failing.
     */
    async environmentName(): Promise<string | undefined> {
        const banner = await this.environmentBanner();
        if (!(await banner.isExisting())) {
            return undefined;
        }
        const text = (await banner.getText()).trim();
        return text.length > 0 ? text : undefined;
    }

    /**
     * The signed-in account name.
     *
     * Falls back to the profile dropdown, which is where the name lives on a
     * phone where the header itself is condensed.
     */
    async accountName(): Promise<string | undefined> {
        const headerName = await this.userName();
        if ((await headerName.isExisting()) && (await headerName.isDisplayed())) {
            const text = (await headerName.getText()).trim();
            if (text.length > 0) {
                return text;
            }
        }

        await this.openProfileMenu();
        const inMenu = await browser.$('.company-name');
        if (await inMenu.isExisting()) {
            const text = (await inMenu.getText()).trim();
            if (text.length > 0) {
                return text;
            }
        }
        return undefined;
    }

    /** The "Sign out" control inside the profile menu. */
    async signOutLink() {
        return browser.$('a[href*="sign_out"], a[href*="logout"]');
    }
}
