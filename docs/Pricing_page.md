# Pricing page configuration

The public pricing page is available at `/pricing`. All **Get Started** links open `/signup`, which follows the existing disclaimer and registration flow.

Edit `client/src/lib/pricing-plans.ts` to change plan prices, account limits, card highlights, and comparison factors:

- `pricingPlans` defines the four plans and their feature values. Use `true` for included, `false` for unavailable, and a string for limits or custom terms.
- `pricingFeatureGroups` defines the comparison rows and their order. Add a feature with a unique `id` and `label`, then supply its value in each plan's `features`.
- Set a feature's `compare` to `false` to hide its comparison row without removing it from plan-card highlights. Set it back to `true` or omit it to display the row.
- `highlights` lists the feature IDs shown on each plan card. Keep those feature definitions present even when their comparison rows are hidden.

Plus and Pro prices remain `$TBD`. The page describes plan packaging only; it does not implement payments, save a plan selection, or enforce account limits.
