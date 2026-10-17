---
name: Unknown account rates
description: Product rule distinguishing missing asset returns and debt APRs from explicit zero rates.
---

Missing asset interest/return rates and liability APRs mean unknown, not 0%. Only an explicitly supplied zero rate should be treated as zero interest/return. Existing stored zero rates must not be bulk-converted to unknown without evidence of their origin.

**Why:** The user confirmed the distinction for liabilities and explicitly extended it to assets. Historical default zeros cannot be distinguished safely from intentional entries.

**How to apply:** Preserve missing rates through manual entry, imports, and bank linking. Exclude unknown rates from current interest/return estimates and weighted-rate denominators while still counting all asset values and debt balances. Clearly disclose incomplete estimates. Preserve separately documented retirement projection assumptions.
