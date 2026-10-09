---
name: Financial import duplicate policy
description: Product constraints for conservative duplicate warnings and editable file review.
---

Treat content-based financial matches as uncertain, not proof that a transaction must be deleted. Users must be able to explicitly retain legitimate repeated charges; reliable source-identity repeats cannot be retained twice.

**Why:** Two real purchases can have the same merchant, date and amount. Preventing duplicate uploads must not remove legitimate spending from the user's ledger.

**How to apply:** Preserve an editable review and a final confirmation before any file-import ledger writes. Identify duplicates after processing/categorization. Keep raw source-account context separate from verified Plaid account identity; missing or differently formatted account metadata is not proof of a separate account. Possible content matches start unchecked; checking the row's Save checkbox is the explicit opt-in to keep it. Do not add a separate “keep anyway” action.

For uncertain saves, preserve the unchanged request's identity across retries rather than silently creating a new import attempt.

**Why:** The database can commit successfully even when the client loses the response; treating that as a new attempt can duplicate explicitly retained repeated charges.

**How to apply:** Retry an uncertain save unchanged, and reuse the committed result. Changing financial rows is a new operation, not a retry.
