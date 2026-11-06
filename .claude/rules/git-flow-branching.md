# GitHub Flow & Branch Naming Convention Rule

**Version:** 1.0
**Last Updated:** November 2026

---

# 1. Branching Strategy

This project follows **GitHub Flow**, a simple branching model optimized for CI/CD and continuous deployment.

The repository holds a single product: a **mobile-web** UI test framework. WebdriverIO v9 drives the Shipmondo web app inside a mobile browser on a simulator/emulator — Safari on an iPhone 17 (XCUITest) and Chrome on a Samsung Galaxy S25 (UiAutomator2). There is no second suite and no second delivery pipeline in this repository, so the branching model stays deliberately small.

## Permanent Branch

| Branch    | Purpose                                | Usage   |
| --------- | -------------------------------------- | ------------ |
| `main`    | Stable test framework, always usable | Team integration & CI/CD |

---

# 2. Branch Types

We use short, intent-based prefixes:

| Type        | Purpose                                     |
| ----------- | ------------------------------------------- |
| `feat/`     | New features or test coverage additions     |
| `fix/`      | Bug fixes (functional or test-related)      |
| `hotfix/`   | Urgent production fixes                     |
| `refactor/` | Code restructuring without behavior change  |
| `chore/`    | Maintenance, dependencies, tooling, configs |
| `docs/`     | Documentation updates                       |
| `test/`     | Test-only changes (new tests, test fixes)   |

> No separate `ci/` prefix — covered by `chore/`.

---

# 3. Branch Naming Convention

## Format

```
<type>/<issue-id>-<kebab-case-description>
```

## Examples

```
feat/qa-1234-add-android-viewport-test
feat/qa-4567-add-off-canvas-navigation-tests
fix/qa-7890-login-timeout-error
hotfix/qa-9001-payment-crash
refactor/qa-1111-extract-auth-service
chore/qa-2222-update-wdio-capabilities
docs/qa-3333-update-test-framework-guide
test/qa-4444-add-shipment-drafts-regression-tests
```

The descriptions above name the subject of the change in terms of this project: a **viewport** assertion, an **off-canvas navigation** test, **WebdriverIO capabilities**, a **page object** extraction. When a branch touches a device, a browser session or a runner configuration, the description says so — `chore/qa-2222-update-wdio-capabilities` beats `chore/qa-2222-update-config`, because the reader learns the scope before opening the diff.

---

## Rules

1. Always lowercase
2. Use kebab-case only
3. Include issue ID when available (format: `qa-1234`, `jira-5678`, `gh-9999`, etc.)
4. Keep description short (2–5 words)
5. One logical change per branch
6. No personal names or temporary branches (`wip`, `temp`, `test-stuff` are forbidden)

---

# 4. Git Workflow

## Create Branch

```bash
git checkout main
git pull origin main

git checkout -b feat/qa-1234-add-user-profile
```

---

## Before Pushing

```bash
git fetch origin
git rebase origin/main

npm run typecheck
```

`npm run typecheck` runs `tsc --noEmit` over the whole project and is the mandatory pre-push gate: it is the only check in this repository that does not require a device, an Appium server or a browser session, so it must pass locally before a branch is ever pushed.

A full device run (`npm run test:ios` or `npm run test:android`) is expected before merging a branch that changes specs, page objects or components. That run needs an environment this repository does not provision — see the `appium-mobile-first` rule: the simulator, the emulator and the Appium server must already exist on the host. The branch is not blocked by the absence of a device; the merge is blocked by the absence of a green typecheck.

---

## Merge Flow (Pull Request)

1. Create Pull Request → `main`
2. Ensure CI passes
3. Code review approval required
4. Merge using squash or rebase (preferred)
5. Delete branch after merge
6. `main` remains stable and usable by the team

---

## Hotfix Flow

For urgent test framework fixes:

```bash
git checkout -b hotfix/qa-9999-critical-bug main
# Fix, typecheck, commit
# Create PR directly to main
# Fast-track review and merge
```

> Hotfixes bypass normal release process and merge directly to main — use only for critical test framework issues.

---

# 5. CI/CD Branch Rules

```yaml
on:
  push:
    branches:
      - main
      - "feat/*"
      - "fix/*"
      - "hotfix/*"
      - "refactor/*"
      - "chore/*"
      - "docs/*"
      - "test/*"
```

> Note: Using single-level globs (`feat/*`) avoids triggering CI on nested/temporary branches. Remove this line if your team explicitly needs nested branch structures.

---

# 6. Branch Name Validation (Husky Hook)

## Recommended Hook: `pre-push`

```bash
#!/usr/bin/env bash

BRANCH_NAME=$(git rev-parse --abbrev-ref HEAD)

# Allow permanent branches
if [ "$BRANCH_NAME" = "main" ]; then
  exit 0
fi

PATTERN="^(feat|fix|hotfix|refactor|chore|docs|test)/([a-z0-9]+-[a-z0-9]+-)?[a-z0-9]+(-[a-z0-9]+)*$"

if ! echo "$BRANCH_NAME" | grep -Eq "$PATTERN"; then
  echo "Invalid branch name: $BRANCH_NAME"
  echo "Format: <type>/<issue-id>-<description>"
  echo "Examples:"
  echo "  - feat/qa-1234-add-android-viewport-test"
  echo "  - fix/qa-7890-login-timeout-error"
  echo "  - chore/qa-2222-update-wdio-capabilities"
  exit 1
fi
```

---

# 7. Best Practices

* Keep branches small and focused
* Prefer frequent merges over long-lived branches
* Rebase regularly with `main`
* Avoid mixing refactor + feature work in one branch
* Always link branches to issues when possible
* Never commit a change that assumes a device, an Appium server or a `browserName` that the repository does not declare in `config/devices.ts` and the platform configs

---

# 8. Recommended Mapping (Mental Model)

| Work Type          | Branch Type |
| ------------------ | ----------- |
| New test cases     | `feat/`     |
| Test-only changes (new specs, test fixes) | `test/` |
| Fix flaky tests    | `fix/`      |
| Framework cleanup  | `refactor/` |
| Dependency updates (Appium, WebdriverIO, drivers) | `chore/` |
| Device and capability changes (`config/devices.ts`, `wdio.*.conf.ts`) | `chore/` |
| Documentation      | `docs/`     |
| Production issue   | `hotfix/`   |

---

# 9. Simplified Enforcement Checklist (PR Review)

* [ ] Branch follows naming convention (type + format + issue ID if applicable)
* [ ] Scope is single responsibility
* [ ] `npm run typecheck` passes
* [ ] Device run passes for the affected platform (iOS, Android, or both)
* [ ] Code reviewed and approved
* [ ] Branch deleted after merge

---

# 10. Design Principles

This convention is built on:

* Simplicity over strict Git Flow complexity
* Fast CI/CD feedback loops
* Readable history in `git log`
* Automation-friendly validation
* Scalability for QA + mobile UI testing

---

# Version History

| Version | Date           | Notes                                                                                            |
| ------- | -------------- | ------------------------------------------------------------------------------------------------ |
| 1.0     | November 2026  | GitHub Flow model adapted for the mobile-web framework: WebdriverIO/Appium naming, `npm run typecheck` as the pre-push gate, device-scoped run in the merge checklist |
