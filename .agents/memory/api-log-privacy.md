---
name: API log privacy
description: Safe diagnostics for APIs that process financial and personal data.
---

API access logs should contain only method, registered route template, status, and duration. Error logs should retain a safe route or operation label plus a fixed error type and protocol/database code, never response bodies, raw URLs, query strings, exception messages, stacks, provider payloads, or arbitrary error fields.

**Why:** Financial values, account identifiers, user-entered AI questions, contact details, and provider or database errors can include private customer data.

**How to apply:** Keep dynamic request values out of log context. Use registered route templates rather than incoming URLs, and send caught API errors through the safe summary format. Add tests with recognizable private sentinel values to prove they cannot appear in logs.
