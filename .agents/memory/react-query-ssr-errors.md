---
name: React Query SSR errors
description: Rendering seeded React Query error states in static UI tests.
---

When seeding an errored query for renderToStaticMarkup tests, disable retryOnMount as well as retry in the test QueryClient.

**Why:** RetryOnMount can optimistically reset an errored query to pending during rendering even with retry disabled; the test then sees loading instead of the intended error UI.

**How to apply:** Set retryOnMount: false in the test-only client for error-state fixtures. Do not change production retry behavior merely to satisfy a static test.
