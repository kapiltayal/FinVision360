# Pricing page configuration

Reviewed against repository code: **2026-10-18**. [Documentation index](README.md).

The public pricing page is available at `/pricing`, with the shared marketing header and compact blue-toned hero.

## Plans and call-to-action behavior

| Plan | Advertised monthly price | Packaging |
| --- | --- | --- |
| Free | $0 | Net worth, budgets, retirement, wealth protection, estate, AI Copilot, recommendations, manual entry and file uploads |
| Plus | $TBD; most popular | Free features and up to 4 Plaid accounts |
| Pro | $TBD | Free features, up to 10 Plaid accounts, and up to 1 insurance integration account |
| Custom | Custom pricing | Features/limits tailored to the user's needs |

These are advertised packages, not evidence that a paid entitlement or insurance-account connector is implemented.

- Signed out: every **Get Started** link opens `/signup`, following the disclaimer and registration flow.
- Signed in: Free opens `/snapshot` as **Go to Dashboard**; Custom opens `/contact` as **Contact Us**.
- Signed in: Plus/Pro show that upgrades are unavailable rather than reopening signup or pretending to activate a paid plan.
- While authentication is loading, the action is disabled to avoid routing a signed-in user to signup.

## Configuration

Edit `client/src/lib/pricing-plans.ts` to change plan prices, account limits, card highlights, and comparison factors:

- `pricingPlans` defines the four plans and their feature values. Use `true` for included, `false` for unavailable, and a string for limits or custom terms.
- `pricingFeatureGroups` defines the comparison rows and their order. Add a feature with a unique `id` and `label`, then supply its value in each plan's `features`.
- Set a feature's `compare` to `false` to hide its comparison row without removing it from plan-card highlights. Set it back to `true` or omit it to display the row.
- `highlights` lists the feature IDs shown on each plan card. Keep those feature definitions present even when their comparison rows are hidden.

Plus and Pro prices remain `$TBD`. The page describes plan packaging only; it does not implement payments, save a plan selection, or enforce account limits.
