import { LoginPage } from '../pages/login.page';
import { DashboardPage } from '../pages/dashboard.page';
import { ShipmentsPage } from '../pages/shipments.page';
import { OrdersPage } from '../pages/orders.page';
import { AddressBookPage } from '../pages/address-book.page';
import { SettingsPage } from '../pages/settings.page';
import { SidebarComponent } from '../components/sidebar.component';
import { TopbarComponent } from '../components/topbar.component';
import { DatatableComponent } from '../components/datatable.component';
import { FlashMessageComponent } from '../components/flash-message.component';
import { MobileShellComponent } from '../components/mobile-shell.component';
import { AuthService } from '../services/auth.service';
import { AppDataService } from '../services/app-data.service';

/**
 * The composition root of the mobile-web suite.
 *
 * The container hands a spec everything it needs to drive the app:
 * the **pages** (one per route), the **components** (the reusable shell
 * regions) and the **services** (the flows and the internal API).
 *
 * Dependency order: services → pages → components.
 *
 * The container is constructed per test rather than per worker, but it holds
 * no state of its own — the browser session is the state.
 */

/** The page objects, one per route of the app. */
export interface AppPages {
    login: LoginPage;
    dashboard: DashboardPage;
    shipments: ShipmentsPage;
    orders: OrdersPage;
    addressBook: AddressBookPage;
    settings: SettingsPage;
}

/** The reusable shell regions. */
export interface AppComponents {
    sidebar: SidebarComponent;
    topbar: TopbarComponent;
    datatable: DatatableComponent;
    flash: FlashMessageComponent;
    mobile: MobileShellComponent;
}

/** The flows and the internal API access. */
export interface AppServices {
    auth: AuthService;
    appData: AppDataService;
}

/** Everything a mobile-web spec needs. */
export interface AppContainer {
    pages: AppPages;
    components: AppComponents;
    services: AppServices;
}

/**
 * Builds the container.
 *
 * The objects are cheap — they hold no state — so building them per test
 * costs nothing and keeps a test from ever seeing a page object that was
 * configured for a different session.
 */
export function createAppContainer(): AppContainer {
    return {
        pages: {
            login: new LoginPage(),
            dashboard: new DashboardPage(),
            shipments: new ShipmentsPage(),
            orders: new OrdersPage(),
            addressBook: new AddressBookPage(),
            settings: new SettingsPage(),
        },
        components: {
            sidebar: new SidebarComponent(),
            topbar: new TopbarComponent(),
            datatable: new DatatableComponent('shipments'),
            flash: new FlashMessageComponent(),
            mobile: new MobileShellComponent(),
        },
        services: {
            auth: new AuthService(),
            appData: new AppDataService(),
        },
    };
}
