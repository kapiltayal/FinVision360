---
name: Merchant identity fallbacks
description: Why imported merchant text may be a bank descriptor rather than a clean brand identity.
---

A nonblank transaction merchant field is not necessarily a canonical identity: imports can copy the source description when no clean merchant name is available.

**Why:** Treating all nonblank merchant values as clean identities excludes normal Plaid/file charges with changing reference numbers from known-merchant matching and can split their recurring history.

**How to apply:** Prefer exact canonical identities. Missing merchant values or merchant text equivalent to the normalized description can use guarded whole-token brand matching. Preserve descriptor grouping for unmatched imports, and do not override a distinct explicit identity with incidental brands in its description. Brand matches and subscription flags alone are never proof of recurrence.
