---
name: Unknown liability APR
description: Product rule distinguishing missing debt interest rates from explicitly supplied zero rates.
---

Missing liability APR means unknown, not 0%. Only an explicitly supplied zero rate should be treated as zero interest. Existing stored zero rates must not be bulk-converted to unknown without evidence of their origin.

**Why:** The user confirmed this distinction and agreed to leave existing zero-rate records unchanged because historical defaults cannot be distinguished safely from intentional entries.

**How to apply:** Preserve missing APRs through manual entry, imports, and bank linking. Exclude unknown rates from interest estimates and weighted-rate denominators while still counting their debt balances. Clearly disclose incomplete estimates.
