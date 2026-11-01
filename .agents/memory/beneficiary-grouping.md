---
name: Beneficiary grouping
description: Identity limits and financial interpretation of the beneficiary-centric estate view.
---

Beneficiary grouping is a reporting convenience, not a verified identity system. Only ignore casing and extra whitespace when combining names; do not fuzzy-match personal names.

**Why:** Existing designations identify people by free-text names rather than a shared person record. Similar names can refer to different people, and identical names can still collide. More aggressive merging would imply identity certainty the application does not have.

**How to apply:** Disclose name-based grouping in the beneficiary view. If distinct-person records are introduced later, use their identities rather than extending name heuristics. Keep beneficiary totals based on saved account percentages, not the full value of each linked account; show missing portions as unassigned and flag excessive saved allocations instead of silently redistributing them.
