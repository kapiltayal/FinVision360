---
name: Beneficiary grouping
description: Identity limits and financial interpretation of the beneficiary-centric estate view.
---

Use saved beneficiary identities for selections and reporting. Only ignore casing and extra whitespace when reusing or migrating legacy names; never fuzzy-match personal names.

**Why:** The reusable list was requested so users do not repeatedly enter the same beneficiary across accounts. Names are not verified identities, and similar names can refer to different people. Existing free-text designations must remain financially unchanged during migration.

**How to apply:** Keep each user's list private, preserve reusable beneficiaries when account allocations are removed, and allow people without assignments to remain visible with zero allocated. Keep totals based on saved account percentages, not the full value of each linked account; show missing portions as unassigned and flag excessive allocations instead of silently redistributing them.

Keep Beneficiary view visually concise: individual horizontal cards, with no duplicate allocation-overview or allocation-heading panel.

**Why:** The user explicitly approved this layout after finding repeated summary text overwhelming.

**How to apply:** Put additional guidance in context or on demand rather than adding another prominent summary section.
