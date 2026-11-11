# Contributing

## Branching (gitflow)

| Branch      | Purpose                                                                                             |
| ----------- | --------------------------------------------------------------------------------------------------- |
| `main`      | Released code only. Protected: changes arrive **only through pull requests** (no direct push).      |
| `develop`   | Integration branch. Feature PRs target this branch.                                                 |
| `feature/*` | New work, branched from `develop`, merged back via PR.                                              |
| `release/*` | Release preparation from `develop` (version bump, changelog). Merged into `main` **and** `develop`. |
| `hotfix/*`  | Urgent fixes branched from `main`, merged into `main` **and** `develop`.                            |

`main` rejects direct pushes, force-pushes and deletion, for everyone including the owner. Releases and hotfixes reach it through a pull request.

Releases are published **automatically when a version reaches `main`**: the release workflow reads the version in `src/manifest.json`, and if it has no tag yet it validates, builds the `.jpl`, creates the tag `vX.Y.Z` and publishes a GitHub release (notes taken from `CHANGELOG.md`). Do not tag by hand.

Commit messages follow [Conventional Commits](https://www.conventionalcommits.org/) (`feat:`, `fix:`, `docs:`, `test:`, `chore:`).

## Before opening a PR

```bash
npm run validate
```

This runs ESLint, Prettier, the TypeScript check and Jest, then regenerates the README coverage badges in `.github/badges`. Coverage thresholds (100% statements/lines/functions, 95% branches) must hold. New behavior needs tests.

Commit the updated badges together with the code: CI fails when `.github/badges` is outdated, and nothing pushes to `main` on its own.

## Starting a version

The first commit of the work on a new version sets its **development version**, so every local package (`npm run dist`) is identifiable as a pre-release in Joplin's plugin list:

```bash
npm run version:set -- 0.3.0-dev   # package.json, package-lock.json and src/manifest.json together
```

The release workflow refuses to publish a `-dev` version, so it cannot reach `main` by accident.

## Releasing

1. `git checkout -b release/x.y.z develop`
2. `npm run version:set -- x.y.z` (drops the `-dev` suffix in all three files) and turn the `[Unreleased]` section of `CHANGELOG.md` into `[x.y.z] - date` (the release notes come from it, and an empty section fails the release).
3. Run `npm run validate`, push the branch and open a pull request `release/x.y.z` → `main`. Merge it with a merge commit once CI is green.
4. **Merging that PR is the release**: the workflow tags `vX.Y.Z` and publishes it. Follow it in the Actions tab.
5. Merge `release/x.y.z` back into `develop`.

A pull request merged into `main` that does not change the version (a docs fix) releases nothing.

## Design docs

Behavior and architecture decisions live in `doc/spec`. Update them in the same PR as the code change.

## Piper integration test

`npm run test:integration` downloads the Piper runtime and the smallest pt-BR voice (about 100 MB the first time, kept in `.cache/`), synthesizes sentences with them and checks that the audio is a real, audible WAV. It also transcribes the audio with Whisper tiny (about 75 MB, also in `.cache/`) and requires at least half of the words to be heard, so the speech itself is verified. It needs the internet and runs the downloaded WebAssembly code, so it is **not** part of `npm run validate` or CI; run it before releasing a change to the Piper engine.
