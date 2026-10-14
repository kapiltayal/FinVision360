---
name: Pricing scope
description: Intent behind provisional paid-plan pricing and the marketing-only scope.
---

Plus and Pro monthly prices are intentionally undecided; Custom pricing is based on the customer's needs. Do not invent paid rates or introduce charges or access restrictions without an explicit request.

**Why:** The user specified `$TBD` paid prices and requested a plan comparison whose buttons lead to signup, not a billing or entitlement implementation.

**How to apply:** Treat pricing-page changes as marketing work unless the user separately asks to implement payments, plan persistence, or plan-specific enforcement.

For signed-in visitors, the pricing actions are plan-aware: Free opens the Snapshot dashboard, Plus/Pro show disabled “Coming soon” actions while paid pricing remains TBD, and Custom opens the existing contact form. Signed-out visitors continue to signup for every plan.

**Why:** The signup dialog should not prompt an existing account holder to create another account, and paid plans are not yet available for purchase.

**How to apply:** Keep these paths in sync across the plan cards and the pricing page's bottom CTA; do not make a paid CTA appear to activate billing.
