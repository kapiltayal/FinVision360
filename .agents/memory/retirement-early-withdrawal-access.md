---
name: Early retirement account access
description: How the Retirement Planner handles pretax account withdrawals before age 59½.
---

The asset model stores broad retirement categories but not account tax treatment. Until tax treatment is modeled explicitly, treat Employer Retirement and Individual Retirement assets as pretax unless the account name contains “Roth”; lock their projected income below age 59½ by default. A per-account early-withdrawal override changes projection availability only and does not model taxes or penalties.

**Why:** Roth accounts should not be incorrectly treated as pretax, while generic 401(k)/IRA labels commonly omit a more specific tax subtype. User overrides are needed for early access assumptions.

**How to apply:** Keep the shared account classification rule consistent between projection generation and the API that saves overrides. Treat the override as a user-owned projection preference, not as tax or legal advice. If an explicit tax-treatment field is added later, replace name inference with that field.