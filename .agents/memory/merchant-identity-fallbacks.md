---
name: Merchant identity fallbacks
description: Why imported merchant text may be a bank descriptor rather than a clean brand identity.
---

A nonblank transaction merchant field is not necessarily a canonical identity: imports can copy the source description when no clean merchant name is available.

**Why:** Treating all nonblank merchant values as clean identities excludes normal Plaid/file charges with changing reference numbers from known-merchant matching and can split their recurring history.

**How to apply:** The requested ingestion policy cleans processor prefixes, store/reference numbers, dates, phone numbers, trailing state abbreviations, punctuation, and whitespace before matching. Resolve exact normalized user history first (user preferences win), exact global names second, then a highly confident unambiguous fuzzy/partial global match; retain the cleaned source name when unresolved. Preserve original descriptions and meaningful brand numbers, and avoid choosing incidental brands or ambiguous near matches.

**Why:** The user requested the same merchant extraction before category identification, duplicate checking, and subscription detection for both uploaded files and Plaid transactions. Previously copied bank descriptors must not prevent normalized identity matching, but aggressive cleanup must not merge unrelated merchants.

Brand text alone is not proof of recurrence. Explicit subscription-only/recurring-only merchant flags remain deterministic recurrence signals under the requested recurrence priority, even without three observations.
