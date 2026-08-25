---
name: Plaid book imports
description: Ownership model for bringing connected accounts into Assets and Liabilities.
---

**Rule:** Connecting or refreshing a Plaid account must not automatically create an Asset or Liability. Users select accounts from the relevant import flow; routine sync updates only records that are already linked.

**Why:** Automatic mirroring made the explicit import choice redundant and could race an import request, producing duplicate financial records. Explicit selection also lets users keep a connected account out of their net-worth book.

**How to apply:** Any future Plaid sync or relink path should refresh account metadata and existing linked book records only. Route new book-entry creation through the transaction-safe account-claim import path.