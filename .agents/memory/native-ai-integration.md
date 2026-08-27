---
name: Native AI integration provisioning
description: Replit-native AI Integrations setup and credential boundary
---

Replit AI Integrations are provisioned through the Agent’s managed-credential flow rather than the ordinary third-party connector inventory. Application code should use the injected `AI_INTEGRATIONS_*` runtime configuration and must not fall back to a personal provider secret.

**Why:** The native AI provider is not represented as an OpenAI connector, and asking for or creating `OPENAI_API_KEY` would bypass Replit-managed billing and credential handling.

**How to apply:** When adding AI to an existing app, rely on Replit’s native confirmation/provisioning flow. Keep provider setup server-side and fail clearly if the managed runtime configuration is unavailable.