---
name: Additive schema changes
description: Safely applying small development schema additions when broad schema synchronization detects unrelated drift.
---

When a broad schema push detects unrelated drift and offers to truncate existing data, do not auto-approve it. For independent, additive changes, apply narrowly scoped idempotent DDL to the development database and keep the declarative schema updated as the source of truth.

**Why:** The installed schema tool can surface unrelated destructive prompts, while its table-filter option cannot be combined with the project config. Auto-approval would risk unrelated application data.

**How to apply:** Use `ADD COLUMN IF NOT EXISTS` or an equally narrow additive statement in development, verify through the application database connection, and verify the actual deployment migration path. Do not assume publishing alone synchronizes this application's database.

New required finance schema must be included in the application's established database bootstrap or an explicitly configured deployment migration, not only a standalone manually run script.

**Why:** A feature can work against an already migrated development database while every preview/save fails after publishing against an older database.

**How to apply:** Keep changes additive and idempotent, serialize concurrent startup migrations, and apply them before serving dependent routes. This is not a workaround for querying the wrong workspace SQL target; verify the app connection first.