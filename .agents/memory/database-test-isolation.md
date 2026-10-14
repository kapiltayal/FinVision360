---
name: Database test isolation
description: Safely share ownership-test fixtures across independently pooled database access paths.
---

Database-backed ownership tests that exercise both raw SQL and ORM handlers must account for separate pooled connections. Use throwaway local users with committed fixtures and identity-scoped cleanup unless every database access path is explicitly pinned to the same test transaction.

**Why:** Uncommitted fixtures on one connection are invisible to another connection, and rolling back that connection does not undo ORM writes made elsewhere. Assertions based only on a fixed month or category can also accidentally include unrelated users' records.

**How to apply:** Opt into these tests only against the development application database, generate unique fixture identities, scope every verification and cleanup query to those identities, and clean up in a finally block. Keep production authentication intact; an identity-injected handler test verifies ownership after authentication, not bearer-token verification itself.
