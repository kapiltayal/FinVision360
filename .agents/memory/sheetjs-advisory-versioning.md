---
name: SheetJS advisory versioning
description: Resolve vendor-distributed SheetJS findings using actual advisory ranges, not stale registry metadata.
---

Use the authoritative SheetJS vendor distribution and compare its version with the advisory's affected range before replacing it. The public npm registry can be older than the vendor release; some scanners also map npm-registry advisories to CDN tarballs using an unbounded range from version zero (OSV-Scanner #3073).

**Why:** The dependency scanner reported SheetJS 0.20.3 for two advisories that actually affect versions below 0.19.3 and 0.20.2. The vendor documents this false-positive problem; downgrading to the public npm release would reintroduce the vulnerabilities.

**How to apply:** Re-check GitHub advisory ranges and current vendor installation documentation. Confirm the lockfile source and integrity match the vendor tarball. Document remaining false positives openly rather than renaming or aliasing packages to hide them. Preserve legacy XLS support unless a replacement's behavior change is explicitly approved.
