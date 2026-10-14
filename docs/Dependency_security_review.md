# Dependency security review

Reviewed: 2026-10-14 (UTC).

## Manifest inventory

A filesystem walk from the workspace root, pruning dependency, VCS, cache, and build directories, found:

- `package.json` and `package-lock.json`: the application's npm dependency tree.
- `.local/skills/replit-auth/templates/lib/replit-auth-web/package.json`: an uninstalled pnpm workspace template, with `workspace:`/`catalog:` dependencies and no lockfile. It contains none of the reported packages. Running `pnpm audit --fix` there reports `ERR_PNPM_AUDIT_NO_LOCKFILE`; creating a standalone dependency tree for this template would be incorrect.

The application's `npm audit fix --ignore-scripts` was run before and after adding the selector-parser override.

## Remediated packages

| Package | Previously installed | Resolved version | Notes |
|---|---|---|---|
| browserslist | 4.24.2 | 4.29.3 | Patched floor for both reported advisories: 4.28.7. |
| postcss-selector-parser | 6.1.2 (also 6.0.10) | 7.1.6 | Override covers Tailwind and Typography, including the newer flat-selector complexity advisory. No Tailwind major migration. |
| qs | 6.15.3 | 6.16.0 | Both reported query-parser advisories fixed. |
| fflate | 0.8.2 | 0.8.3 | ZIP64 infinite-loop fix. |
| dompurify | 3.4.12 | 3.4.17 | Patched floor: 3.4.13. |
| nanoid | 3.3.16 | 3.3.20 | Patched floor on the 3.x line: 3.3.18. |

These six package updates address eight of the ten reported findings.

## Two SheetJS scanner findings are version-range false positives

The application already uses the official vendor tarball for **xlsx 0.20.3**, not the outdated npm-registry release.

- [GHSA-4r6h-8v6p-xvw6](https://github.com/advisories/GHSA-4r6h-8v6p-xvw6) affects versions **below 0.19.3**.
- [GHSA-5pgg-2g8v-p4x9](https://github.com/advisories/GHSA-5pgg-2g8v-p4x9) affects versions **below 0.20.2**.
- The installed **0.20.3** is outside both vulnerable ranges.
- [The vendor's installation documentation](https://docs.sheetjs.com/docs/getting-started/installation/nodejs/) specifies the same 0.20.3 tarball, warns that the public npm registry is outdated, and documents prototype-pollution scanner false positives.

The fresh workspace scanner still reports these two entries. They were not suppressed or concealed. The patched vendor version remains intentionally installed: downgrading to npm's 0.18.5 would reintroduce the vulnerabilities, while replacing the parser with an XLSX-only library would remove existing legacy XLS import support.

## Separate remaining advisory

The fresh audit also reports **GHSA-vfj7-8cjw-p6xm** in `braces@3.0.3`. This is a new finding outside the ten originally listed; there is no published patch. npm reports seven aggregate high-severity notices for its dependent build packages.

In this application, `braces` is used through Tailwind's build-time glob tooling with repository-controlled content patterns. Financial upload routes do not call it, and customer uploads are not build inputs. Keep build configuration trusted. Resolving the dependency itself requires a separate reviewed build-toolchain change; no forced Tailwind major upgrade was performed.

## Verification

- Re-enumerated the complete manifest tree, including untracked nested manifests; only the two manifests described above were found.
- Checked every npm lockfile against the advisory patched floors. No listed old version remains except the reviewed, patched SheetJS 0.20.3 distribution.
- Passed 27 focused tests covering XLS/XLSX/CSV imports, transaction review, and API logging.
- Passed PDF-table export and ZIP round-trip smoke checks.
- Built the client and server successfully and verified the public preview after restarting the application.
- The full TypeScript check still reports the same 14 existing errors in unrelated integration scaffolding and the scraper.

The workspace scanner is **not clean**: it retains the two SheetJS false positives and the separate `braces` advisory. This review does not claim that every dependency risk has been eliminated.
