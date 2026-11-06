# Feature gating per environment

**Document version:** 2026-11-06
**Audience:** QA Engineers, Test Automation Team
**Purpose:** How the suite decides which tests run against which tenant, and
why an unknown feature tag is a hard failure rather than a silent skip.

---

## 1. The problem

The suite runs against three tenants:

| `TEST_ENV` | Tenant |
|---|---|
| `demo` | the public demo tenant — the default |
| `staging` | the candidate-release tenant |
| `release` | the production tenant |

A test that covers a capability the tenant does not have should **not** run
there. It should not fail with "the button does not exist", and it should not
silently pass because the assertion was skipped by hand.

Before the gating mechanism, the alternatives were all worse:

- a hand-written `if (TEST_ENV === 'release') test.skip()` in every test —
  easy to forget, invisible in review;
- running everything everywhere and accepting false failures;
- keeping three copies of the suite.

---

## 2. Two independent tag axes

The **what** is separated from the **when**.

### Axis 1 — suite / selection tags

These say *what kind of test this is*. **You** choose them, at the CLI.

| Tag | Use |
|---|---|
| `@smoke` | the critical happy path |
| `@sanity` | quick validation after a build |
| `@regression` | guard against regressions |
| `@e2e` | a complete user flow |
| `@negative` | error handling and rejections |
| `@boundary` | limits and edge values |
| `@security` / `@accessibility` | specialised passes |
| `@mobile` / `@ui` | which suite the test belongs to |

The constants live in [`src/shared/tags.ts`](../src/shared/tags.ts) — `Tags.SMOKE`,
not the literal `'@smoke'`.

### Axis 2 — feature tags

These say *what capability the test depends on*. **The framework** decides,
from the matrix.

| Tag | Meaning |
|---|---|
| `@feature:orders` | the test needs the orders capability in this tenant |

`featureTag('orders')` builds it — the name must exist in the matrix.

---

## 3. The matrix

The source of truth is [`config/test-policy.json`](../config/test-policy.json):

```json
{
  "envs": {
    "demo":    { "features": { "auth": true, "orders": true, "…": true } },
    "staging": { "features": { "auth": true, "orders": true, "…": true } },
    "release": { "features": { "auth": true, "orders": true, "…": true } }
  }
}
```

Currently all three tenants expose the same capabilities, so every feature is
`true` everywhere — the mechanism is exercised by the *absence* of a feature,
which is the case that matters.

**Every feature must be listed in every env.** A feature missing from an env
is a configuration error, and the policy engine raises it rather than
defaulting to "off".

---

## 4. How the gate behaves

The gate is applied at **definition time** — while the spec file is being
collected, before any browser session exists.

| The feature is… | What happens |
|---|---|
| declared and `true` | the test runs |
| declared and `false` | the test is **skipped**, with the reason in the report |
| **not declared at all** | the collection **throws** — the run fails loudly |

### Why definition time and not a runtime fixture

A runtime fixture would discover a typo in a feature tag *after* the browser
was already on the device. The run would spend minutes on a simulator before
failing on a one-character mistake. Definition-time gating fails in the first
second, with the list of the features that do exist:

```
Feature tag(s) not declared in config/test-policy.json for env "demo": orderz.
Declared features: auth, dashboard, shipments_list, shipments_drafts, orders,
address_book, api_access, account_settings, mobile_web, mobile_navigation.
A typo in a feature tag must fail the run, not silently skip the test.
```

That is the whole point of the design: **a typo must never quietly delete
coverage.** A test that silently skips itself is worse than a test that fails.

---

## 5. Using it

### Tagging a test

```ts
import { describeMobile, itMobile, Tags, featureTag, title } from '../../src/shared';

describeMobile(title(3001, 'Shipmondo login'), {
    features: [featureTag('auth')],
    tags: [Tags.SMOKE, Tags.MOBILE],
}, () => {
    itMobile(title(3001, 'rejects an invalid password'), {
        features: [featureTag('auth')],
        tags: [Tags.SMOKE, Tags.NEGATIVE, Tags.MOBILE],
    }, async () => {
        // the body
    });
});
```

`describeMobile` validates the features of the whole suite; `itMobile` skips
the individual test when its feature is disabled. Both accept the same option
shape:

```ts
interface MobileTestOptions {
    features?: readonly string[];   // featureTag(...)
    tags?: readonly string[];       // Tags.SMOKE, …
}
```

### Running a selection

Tags travel **inside the Mocha title** — WebdriverIO has no native tag
support — so Mocha's `--grep` filters on them:

```bash
# By suite tag
npx wdio run wdio.ios.conf.ts --mochaOpts.grep "@smoke"
npx wdio run wdio.android.conf.ts --mochaOpts.grep "@negative"

# By feature tag
npx wdio run wdio.ios.conf.ts --mochaOpts.grep "@feature:orders"

# By tenant
TEST_ENV=staging npx wdio run wdio.android.conf.ts
```

**Both axes apply.** `--grep "@smoke"` on a tenant where the smoke test's
feature is disabled still skips it.

---

## 6. The rules

### Do

1. **Update the matrix when a capability is promoted** to a tenant.
2. **Tag every capability-dependent test.**
3. **Use the constants** — `featureTag('orders')`, `Tags.SMOKE`.
4. **Keep the matrix complete** — a feature appears in every env.

### Don't

1. **Don't branch on `TEST_ENV` inside a test.**

   ```ts
   // Forbidden — invisible in review, and it never appears in the report.
   if (process.env.TEST_ENV === 'release') { /* skip */ }
   ```

2. **Don't add a feature to only one env.** Missing entries are config
   errors.

3. **Don't invent suite tags.** The taxonomy in `Tags` is deliberately small;
   a new tag needs a reason.

4. **Don't weaken an assertion to make a gated test pass.** If the product
   disagrees with the contract, the assertion stays on the contract's side and
   the drift is reported.

---

## 7. How it is enforced

```
1. The spec file is collected.
2. describeMobile / itMobile read the @feature: tags from the options.
3. The feature name is looked up in config/test-policy.json for TEST_ENV.
   - not in the matrix  → throw   (the run fails loudly)
   - present but false  → it.skip (with the reason)
   - present and true   → the test runs
```

The matrix is read **once per worker** by
[`src/shared/policy.ts`](../src/shared/policy.ts), and the file path is
resolved through [`src/shared/paths.ts`](../src/shared/paths.ts) — never as a
hardcoded string — so the suite behaves the same on a laptop, in CI and in a
container.

### The two axes side by side

| | Suite tags | Feature tags |
|---|---|---|
| Examples | `@smoke`, `@e2e` | `@feature:orders` |
| Who decides | you, at the CLI | the framework, from the matrix |
| Source of truth | `src/shared/tags.ts` + the CLI | `config/test-policy.json` |
| Effect | which tests this execution collects | whether a test may run at all |
| Cardinality | one or many | one or many |

---

## 8. Promoting a capability

1. The capability is live in the tenant.
2. Edit `config/test-policy.json` and set that env's feature to `true`.
3. Commit it on a `chore/` or `feat/` branch.
4. The next run on that tenant picks the tests up automatically — no test
   code changes.

---

## 9. FAQ

**Can a test depend on several features?**
Yes. All of them must be enabled for the test to run; the skip reason lists
every disabled one.

**Can I run a test against a capability that is not in the matrix?**
No — and that is deliberate. Add it to the matrix first, in every env.

**Is the matrix per user or per tenant?**
Per tenant. A gradual rollout is modelled as "not enabled yet" for that
tenant.

**Who maintains the matrix?**
The team, as part of the promotion of a capability to a tenant.

---

## Technical reference

| Module | Role |
|---|---|
| [`src/shared/policy.ts`](../src/shared/policy.ts) | reads the matrix, answers `isDeclared` / `isEnabled` |
| [`src/shared/mocha.ts`](../src/shared/mocha.ts) | `describeMobile` / `itMobile` — the definition-time gate |
| [`src/shared/tags.ts`](../src/shared/tags.ts) | `Tags`, `featureTag`, `featureNameOf` |
| [`config/test-policy.json`](../config/test-policy.json) | the matrix itself |
