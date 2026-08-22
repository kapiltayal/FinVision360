---
name: Application database schema
description: How to verify schema changes affect the database used by the running app.
---

The database exposed through the workspace SQL tool may not be the same PostgreSQL target configured in the app's `DATABASE_URL`. A table that appears in the workspace database can therefore still be absent when the app queries it.

**Why:** Schema changes need to be validated against the connection used by the running server, not just against a separate workspace-managed database.

**How to apply:** Prefer the project's Drizzle schema and normal publish workflow. If a local Drizzle push is blocked by an interactive rename prompt, verify that the intended create operation actually ran against the app connection before treating the schema as applied. Never add startup-time DDL to work around this.