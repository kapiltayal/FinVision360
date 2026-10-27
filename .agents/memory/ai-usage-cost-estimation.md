---
name: AI usage cost estimation
description: Billing semantics and accounting rules for app-level AI usage tracking.
---

Replit AI Integrations expose token usage through the OpenAI-compatible API but do not return actual per-request USD charges. App-level cost totals are estimates using the model provider's public rates.

**Why:** Usage needs to be attributed to individual signed-in users and features, while Replit's actual billing remains account-level and is not available per request through the API.

**How to apply:** Capture prompt, cached-prompt, and completion tokens; compute estimated cost with the applicable model rates at request time. Keep unknown model costs explicitly unpriced and never label estimates as actual billed spend. For streaming completions, request the final usage chunk.
