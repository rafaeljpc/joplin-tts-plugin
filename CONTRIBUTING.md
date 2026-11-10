# Contributing

## Branching (gitflow)

| Branch      | Purpose                                                                                             |
| ----------- | --------------------------------------------------------------------------------------------------- |
| `main`      | Released code only. Every commit on `main` is a release.                                            |
| `develop`   | Integration branch. Feature PRs target this branch.                                                 |
| `feature/*` | New work, branched from `develop`, merged back via PR.                                              |
| `release/*` | Release preparation from `develop` (version bump, changelog). Merged into `main` **and** `develop`. |
| `hotfix/*`  | Urgent fixes branched from `main`, merged into `main` **and** `develop`.                            |

Releases are published **automatically when a version reaches `main`**: the release workflow reads the version in `src/manifest.json`, and if it has no tag yet it validates, builds the `.jpl`, creates the tag `vX.Y.Z` and publishes a GitHub release (notes taken from `CHANGELOG.md`). Do not tag by hand.

Commit messages follow [Conventional Commits](https://www.conventionalcommits.org/) (`feat:`, `fix:`, `docs:`, `test:`, `chore:`).

## Before opening a PR

```bash
npm run validate
```

This runs ESLint, Prettier, the TypeScript check and Jest. Coverage thresholds (100% statements/lines/functions, 95% branches) must hold. New behavior needs tests.

## Releasing

1. `git checkout -b release/x.y.z develop`
2. Bump the version in `package.json`, `package-lock.json` **and** `src/manifest.json` (they must match) and turn the `[Unreleased]` section of `CHANGELOG.md` into `[x.y.z] - date` (the release notes come from it, and an empty section fails the release).
3. Run `npm run validate`, push the branch and merge it into `main` (PR or local merge, both work).
4. **That merge is the release**: the workflow tags `vX.Y.Z` and publishes it. Follow it in the Actions tab.
5. Merge `release/x.y.z` back into `develop`.

A merge into `main` that does not change the version (a docs fix, the badge commit) releases nothing.

## Design docs

Behavior and architecture decisions live in `doc/spec`. Update them in the same PR as the code change.
