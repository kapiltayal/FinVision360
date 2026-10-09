---
name: Artifact preview verification
description: Avoid mistaking the root application's screenshot for a sandbox artifact preview.
---

In this root-app project, the app-preview screenshot tool targets the main application's service even when given a sandbox artifact path. A landing-page screenshot at that path does not verify the sandbox.

**Why:** The main SPA handles unknown paths, so a successful-looking capture can show the landing page instead of the requested component.

**How to apply:** Verify sandbox designs through a browser that can navigate the artifact's routed preview URL. For protected production screens, use the testing browser rather than treating a signed-out screenshot as UI verification.
