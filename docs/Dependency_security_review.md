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
- [OSV-Scanner issue #3073](https://github.com/google/osv-scanner/issues/3073) reproduces this exact CDN-resolved lockfile entry. OSV's generated ranges treat it as affected from version 0, while the source advisories record the actual affected floors as `<0.19.3` and `<0.20.2`. The lockfile's CDN URL and SHA-512 match the official 0.20.3 distribution.

The fresh workspace scanner still reports these two entries, but `npm audit` reports zero findings and the installed vendor build is beyond both source-advisory affected ranges. They were not suppressed or concealed. The patched vendor version remains intentionally installed: downgrading to npm's 0.18.5 would reintroduce the vulnerabilities, while replacing the parser with an XLSX-only library would remove existing legacy XLS import support.

## Build-tooling advisory removed with an approved styling upgrade

**GHSA-vfj7-8cjw-p6xm** in `braces@3.0.3` has no published patch. The user approved upgrading the styling tools rather than leaving the build-only dependency in place.

Tailwind was migrated to **4.3.3**, using its dedicated Vite plugin. The old PostCSS integration and unused autoprefixer dependency were removed. Tailwind Merge was upgraded to **3.7.0**. Neither `braces` nor `brace-expansion` remains in the application lockfile or installed tree.

The legacy theme configuration remains explicitly loaded. Existing palette values, shadows, blur/radius defaults, placeholder styles, button cursors, and accessible focus outlines are preserved with a compatibility stylesheet. Radix menu and chart CSS-variable utilities use the supported Tailwind 4 syntax.

Tailwind 4 requires modern browsers: Safari 16.4+, Chrome 111+, and Firefox 128+.

## Additional dependency findings verified

The subsequent 32-finding review included 31 findings already resolved by the previous npm autofix/selector override, plus the now-removed `braces` finding. Current versions were compared with every listed GitHub advisory:

| Package | Resolved version | Highest required patched floor for the listed findings |
|---|---|---|
| proxy-addr | 2.0.8 | 2.0.8 |
| axios | 1.20.0 | 1.20.0 |
| source-map-js | 1.2.2 | 1.2.2 |
| brace-expansion | Removed | 2.1.7 on its former 2.x branch |
| undici | 7.30.0 | 7.29.1 on the 7.x branch |
| braces | Removed | No published patch |
| multer | 2.4.0 | 2.4.0 |
| dompurify | 3.4.17 | 3.4.16 |
| postcss-selector-parser | 7.1.6 | 7.1.6 |

## Verification

- Re-enumerated the complete manifest tree, including untracked nested manifests; only the two manifests described above were found.
- Checked every npm lockfile against the advisory patched floors. No listed old version remains except the reviewed, patched SheetJS 0.20.3 distribution.
- Passed 27 focused tests covering XLS/XLSX/CSV imports, transaction review, and API logging.
- Passed three additional styling-toolchain regressions covering patched dependency floors, preserved design values/forced-colors focus outlines, and CSS-variable class merging.
- Passed PDF-table export and ZIP round-trip smoke checks.
- Built the client and server successfully. Verified Pricing and Blog on desktop, Pricing on mobile, and the public signup disclaimer after restarting the application. The signup form behind that disclaimer and signed-in screens were not visually verified; authentication was not bypassed.
- The full TypeScript check still reports the same 14 existing errors in unrelated integration scaffolding and the scraper.

`npm audit` reports **zero vulnerabilities**. The workspace scanner retains **only the two documented SheetJS false positives**; none of the 32 subsequent findings remains. This review does not suppress scanner results or claim protection against all future dependency risks.
