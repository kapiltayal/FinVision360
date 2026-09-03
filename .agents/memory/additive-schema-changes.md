---
name: Additive schema changes
description: Safely applying small development schema additions when broad schema synchronization detects unrelated drift.
---

When a broad schema push detects unrelated drift and offers to truncate existing data, do not auto-approve it. For independent, additive changes, apply narrowly scoped idempotent DDL to the development database and keep the declarative schema updated as the source of truth.

**Why:** The installed schema tool can surface unrelated destructive prompts, while its table-filter option cannot be combined with the project config. Auto-approval would risk unrelated application data.

**How to apply:** Use `ADD COLUMN IF NOT EXISTS` or an equally narrow additive statement in development, verify through the application database connection, and rely on Replit's Publish flow to diff and apply the development schema to production.