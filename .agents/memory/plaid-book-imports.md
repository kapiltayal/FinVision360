---
name: Plaid book imports
description: Ownership model for bringing connected accounts into Assets and Liabilities.
---

**Rule:** Connecting or refreshing a Plaid account must not automatically create an Asset or Liability. Users select accounts from the relevant import flow; routine sync updates only records that are already linked.

**Why:** Automatic mirroring made the explicit import choice redundant and could race an import request, producing duplicate financial records. Explicit selection also lets users keep a connected account out of their net-worth book.

**How to apply:** Any future Plaid sync or relink path should refresh account metadata and existing linked book records only. Route new book-entry creation through the transaction-safe account-claim import path.

**Deletion:** Removing a Plaid-linked Asset or Liability releases that account's import claim without disconnecting the institution. A claim pointing to a missing book entry is not "already imported."

**Why:** Users may intentionally remove a book entry and later re-import the same connected account. A leftover claim blocks that choice even though the entry no longer exists.

**How to apply:** Clear the claim atomically when deleting the book entry, and confirm that a claimed entry still exists for the same user before treating it as imported.

**Reauthentication:** Repair `ITEM_LOGIN_REQUIRED` with Plaid Link update mode for the existing Item. Do not exchange a new public token or replace the Item.

**Why:** Plaid keeps the existing access token after update mode succeeds. Replacing the Item can create duplicates, and disconnecting this app's Item deletes its linked book entries.

**How to apply:** Create an update-mode Link token with the existing access token; after Link succeeds, retry the normal account sync.