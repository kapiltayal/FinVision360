---
name: Merchant identity fallbacks
description: Why imported merchant text may be a bank descriptor rather than a clean brand identity.
---

A nonblank transaction merchant field is not necessarily a canonical identity: imports can copy the source description when no clean merchant name is available.

**Why:** Treating all nonblank merchant values as clean identities excludes normal Plaid/file charges with changing reference numbers from known-merchant matching and can split their recurring history.

**How to apply:** Clean processor prefixes (including STRIPE, VENMO and CASHAPP), store/reference numbers, dates, phone numbers, trailing state abbreviations, punctuation and whitespace. Resolve exact normalized user history first, exact global names/individual comma-separated keywords next, then the longest catalog name/keyword contained anywhere, then confident fuzzy matching; use Proper Case cleaned text if unresolved. Preserve original descriptions and meaningful brand numbers.

Literal substring matching intentionally replaces the previous guarded-prefix/incidental-brand rejection policy for ingestion only. It can choose a merchant referenced incidentally in the descriptor.

**Why:** The user explicitly requested matching names/keywords anywhere in the transaction string, with the longest match winning before fuzzy matching.

**How to apply:** Do not restore the old prefix/token restrictions as a silent safeguard. Exact-key and equal-length ties prefer canonical names, then lowest merchant ID, then lexical name; fuzzy ambiguity is measured between distinct merchants, not aliases of the same merchant. Keep the independent recurrence matcher unchanged.

**Why:** The user requested the same merchant extraction before category identification, duplicate checking, and subscription detection for both uploaded files and Plaid transactions. Previously copied bank descriptors must not prevent normalized identity matching, but aggressive cleanup must not merge unrelated merchants.

Brand text alone is not proof of recurrence. Explicit subscription-only/recurring-only merchant flags remain deterministic recurrence signals under the requested recurrence priority, even without three observations.
