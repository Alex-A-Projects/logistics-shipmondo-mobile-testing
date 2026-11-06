# The Shipmondo web app

**Document version:** 2026-11-06
**Audience:** QA Engineers, Test Automation Team
**Purpose:** What the application under test actually looks like, so that a
locator is written from a fact rather than from a guess.

Everything below was verified against the live demo tenant at
`https://demo.shipmondo.com`. Where the app behaves differently on a phone,
that difference is called out — see also
[MOBILE-WEB-GUIDE.md](./MOBILE-WEB-GUIDE.md).

---

## 1. What the application is

Shipmondo is a hosted shipping platform: a customer buys a label, the parcel
is picked up, and the shipment is tracked. The web app is the customer-facing
administration surface.

**The app under test is the web app.** There is no native client in this
framework, and none is expected: the suite drives the browser on the device.

| | |
|---|---|
| Base URL (demo) | `https://demo.shipmondo.com` |
| Login page | `/account/login?locale=en` |
| Pre-fills the address | `/account/login?locale=en&email=<address>` |
| Single-page app | `/main/app/#/<route>` |
| Technology | Rails server-rendered shell + **AngularJS 1.2.26** SPA |

The login page accepts an `email` query parameter, which pre-fills the address
field. It is a convenience, not an authentication mechanism — the password is
still typed.

---

## 2. The shell

The authenticated app is a responsive admin theme:

```
#header                    ← top bar: environment badge, account name, profile avatar
#left-panel                ← the navigation; an off-canvas drawer on a phone
#content                   ← the route region; carries a route-specific class
#navigation-backdrop       ← the translucent overlay that closes the drawer
```

`#content` is the important one. The SPA swaps the content region **in place**
and stamps the *active route's* class onto it:

| Route | Class on `#content` |
|---|---|
| `#/dashboard` | `dashboard` |
| `#/orders` | `order-content` |
| `#/shipping-labels` | `shipping-labels-content` |
| `#/shipping-label-drafts` | `shipping-label-draft-content` |
| `#/address-book` | `address-book-content` |
| `#/setting/api` | `api-credential-content` |

**This class is the only reliable "which route am I on" signal** that survives
the transition: when the class changes, the previous view's DOM is already
gone. A generic selector such as `#content` would match the *previous* route's
content and make a readiness wait a no-op.

`routeContent(route)` and `routeTableXPath(route)` in
[`src/mobile/selectors.ts`](../src/mobile/selectors.ts) build the selectors
from this table. Use them; do not hand-roll a selector.

---

## 3. The list structure — every list renders its table twice

Each list (shipments, orders, drafts, address book, API access) renders **two**
tables:

1. a **header-only clone** (`table.dataTable`, no `tbody` rows) used for the
   fixed header, and
2. the **scrolling body table** that carries the rows.

A naive `table.dataTable` selector therefore matches two elements, and a
count over it is double the real number of rows. The suite addresses the body
table only:

```ts
//*[@id="content"][contains(@class,"order-content")]
  //table[contains(@class,"dataTable")][.//tbody/tr]
```

**XPath rather than CSS `:has()`.** Appium's selector engines do not
implement `:has()` consistently — XCUITest on iOS and UiAutomator2 on Android
differ — so the body table is selected with XPath.

**Column 1 is always the row-select checkbox column**, so the first
*meaningful* column is column 2. The API-access list is the exception: it has
no checkbox column, so its name is column 1.

### The DataTables envelope

The lists are filled by a `POST .../datatable.json` endpoint that answers
with a DataTables envelope:

```json
{ "draw": 1, "recordsTotal": 68, "recordsFiltered": 68, "data": [ … ] }
```

The paging info line ("Showing 1 to 25 of 68 entries") lives in
`.dataTables_info`, and the "no rows" state is a `td.dataTables_empty` cell.

The demo tenant is **not seeded**: the address book and the drafts list are
empty, the shipments and orders lists are not. A list assertion therefore
compares the rendered list against the backing endpoint instead of assuming a
row count.

---

## 4. The navigation drawer

On a desktop the navigation is a fixed left sidebar. On a phone it is an
**off-canvas drawer**:

- the panel `#left-panel` is parked outside the viewport;
- a hamburger toggle opens it — the theme ships `#hide-menu`, and the
  component also accepts `#mobile-menu-toggle`, `.navbar-toggle` and
  `[data-toggle="sidebar"]` so a slightly different theme build does not break
  the suite;
- the shell adds `body.mobile-view-activated` while the drawer is open;
- `#navigation-backdrop` closes it again.

**`isDisplayed()` is true for a closed drawer.** The element still has a box;
it is merely translated out of the viewport. The component therefore decides
"is the drawer reachable?" from the element's **viewport rectangle**, which is
the only signal that separates "hidden in the drawer" from "hidden by CSS".

### Groups are accordions

The navigation is a tree:

```
#left-panel > nav > ul
  └ li[data-menu-collapse]          ← a collapsible GROUP
      ├ a                           ← the group's toggle (href="#")
      └ ul
          ├ li > a[href="#/route"]   ← a LEAF link
          └ li[data-menu-collapse]   ← a nested group
```

Two behaviours matter:

- a **leaf is invisible until its group is expanded** — the group `<ul>` carries
  `display: none` while collapsed, so the leaf cannot be tapped before the
  group is opened;
- **groups behave like an accordion** — opening one collapses the others, so
  groups must be expanded outermost-first. The component walks the
  `ancestor::li[@data-menu-collapse]` axis from the outermost group inwards.

A leaf may sit several groups deep: *Settings → Integrations → API* is three
levels, which is why `API access` takes the longest to reach on a phone.

---

## 5. The login page

A plain Rails form:

| Element | Selector |
|---|---|
| E-mail | `#user_email` |
| Password | `#user_password` |
| Remember me | `#user_remember_me` |
| Submit | `input[type=submit]` |
| Server error | `.alert.alert-danger` |
| Inline e-mail error | `#user_email-error` |
| Inline password error | `#user_password-error` |

The page always carries a standing `.alert.alert-warning` notice ("You are
entering a demo environment."), so the failure message is matched by the
specific `.alert.alert-danger` variant.

### What the server and the client each do

Verified against the live app:

| Input | Who rejects it | What happens |
|---|---|---|
| Wrong password | **the server** | The form POSTs, the page re-renders with `.alert.alert-danger` ("The information entered is not valid.") and the URL is `/account/login` |
| Malformed e-mail | **the client** | The URL is unchanged, **no** `.alert` is rendered, `#user_email-error` reads "Please fill in correct e-mail" |
| Empty password | **the client** | The URL is unchanged, `#user_password-error` reads "Please fill in password" |

The client-side block means **no request reaches the server**, so only a wrong
password produces a server rejection. A test that expects `.alert-danger`
after a malformed address is testing the wrong thing.

The inline errors are `<em>` elements, not alerts — they are matched by id.

---

## 6. The internal API

The app reads its own JSON endpoints from inside the SPA:

```
/api/v1/status_overview
/api/v1/resource_counts_overview
/api/v1/activity_chart
```

and the lists read `POST .../datatable.json`.

These are **not** the public API v3. They are the app's own endpoints, and
they are protected by three rules:

1. the **session cookie** must be present;
2. the request must carry **`X-Requested-With: XMLHttpRequest`** — the server
   rejects the request otherwise, so that a browser cannot be tricked into
   issuing it from a plain form;
3. the request must be **same-origin** — a matching `Origin`/`Referer` is
   checked.

The consequence for the suite is simple: **the requests are issued from
inside the mobile browser**, not from the test process.
[`src/mobile/services/app-data.service.ts`](../src/mobile/services/app-data.service.ts)
does that with `browser.executeAsync` and a plain `XMLHttpRequest`, so the
session cookie and the same-origin rules apply exactly as they do to the app's
own XHRs.

Reading the app's own data is what makes the data-consistency assertions
possible: the rendered list and the endpoint it was filled from are compared
at the same moment, from the same session.

The endpoints are **eventually consistent** — a read right after a write may
not see the row yet. The services poll instead of assuming.

---

## 7. The header on a phone

The top bar is condensed on a phone:

- the environment badge is `#logo-group .label` ("Demo");
- the **account name is hidden behind the profile avatar** `#mobile-profile-img`,
  which opens a dropdown;
- inside the dropdown the name is rendered twice — `.company-name` (the
  company) and `.user-name` (the contact). Only `.company-name` is visible for
  an owner.

A test that reads the account name therefore has to open the profile menu
first — or read the name from the dropdown. The top bar component does the
former.

---

## 8. The mobile layout

The theme switches to its mobile breakpoint below 768 CSS pixels. The
switched state is observable in three ways, and the suite uses all three:

| Signal | Meaning |
|---|---|
| `body.mobile-view-activated` | The shell is in its mobile layout |
| `window.innerWidth < 768` | The viewport is phone-sized |
| `window.devicePixelRatio > 1` | A real device screen, not a scaled desktop window |

The device profiles in [`config/devices.ts`](../config/devices.ts) carry the
expected viewport per device (iPhone 17 Pro: 402 × 874; Samsung Galaxy S25:
393 × 852), so the same spec asserts the right thing on either platform.

---

## 9. Selector traps, in one place

1. **No `data-testid`.** Every selector is derived from the real markup.
2. **Every list renders twice.** Address the body table only.
3. **`:has()` is unreliable** across Appium's engines. Use the XPath helper.
4. **Column 1 is the checkbox column.** The first meaningful column is 2.
5. **The route class changes before the rows arrive.** Readiness = route class
   **plus** a rendered element, never the URL alone.
6. **A closed drawer still "is displayed".** Use the viewport rectangle.
7. **Leaves are invisible until their group is expanded**, and groups are
   accordions — expand outermost-first.
8. **The standing demo notice is an `.alert`.** Match `.alert-danger` for a
   real failure.

---

## 10. Where the selectors live

Every selector is in one file —
[`src/mobile/selectors.ts`](../src/mobile/selectors.ts) — with a comment
explaining why it is what it is. A new selector is added there, never inline
in a spec or a page object.
