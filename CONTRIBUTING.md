# Contributing

## Branching (gitflow)

| Branch      | Purpose                                                                                             |
| ----------- | --------------------------------------------------------------------------------------------------- |
| `main`      | Released code only. Every commit on `main` is a release.                                            |
| `develop`   | Integration branch. Feature PRs target this branch.                                                 |
| `feature/*` | New work, branched from `develop`, merged back via PR.                                              |
| `release/*` | Release preparation from `develop` (version bump, changelog). Merged into `main` **and** `develop`. |
| `hotfix/*`  | Urgent fixes branched from `main`, merged into `main` **and** `develop`.                            |

Releases are tagged `vX.Y.Z` on `main`; the tag triggers the release workflow that builds and attaches the `.jpl`.

Commit messages follow [Conventional Commits](https://www.conventionalcommits.org/) (`feat:`, `fix:`, `docs:`, `test:`, `chore:`).

## Before opening a PR

```bash
npm run validate
```

This runs ESLint, Prettier, the TypeScript check and Jest. Coverage thresholds (100% statements/lines/functions, 95% branches) must hold. New behavior needs tests.

## Releasing

1. `git checkout -b release/x.y.z develop`
2. Bump the version in `package.json` **and** `src/manifest.json` (they must match), update `CHANGELOG.md`.
3. Merge into `main`, tag `vX.Y.Z`, merge back into `develop`.

## Design docs

Behavior and architecture decisions live in `doc/spec`. Update them in the same PR as the code change.
