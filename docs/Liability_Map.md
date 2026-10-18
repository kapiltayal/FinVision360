# Liability Map

Reviewed against repository code: **2026-10-18**. [Documentation index](README.md).

The authenticated `/liability-map` page is the tab after Liabilities within
Net Worth. It reads all accounts from the existing user-scoped liabilities API.
It does not introduce another debt store or change saved liability records.

## Timeline and assumptions

- All bars begin at the current calendar month on one shared time scale.
- Width is remaining months divided by the longest known remaining duration.
- Bar height scales with balance: balance divided by the largest balance, times
  100px, with a 5px minimum. Rows grow to fit the bar plus spacing, with a
  40px minimum row height. The timeline width and relative durations are unchanged.
- APR colors: red above 15%; yellow from 6% through 15%; green below 6%;
  neutral if APR is unknown. Tooltips and keyboard-focus labels include exact
  balances to cents, APR, months remaining, and duration source.
- Summary totals appear unboxed at the top of the timeline. Total interest owed
  is an estimate using the current balance and APR, amortized over the displayed
  remaining duration; debts without a usable APR or duration are excluded.
- Missing APRs remain unknown rather than defaulting to 0%. Only an explicitly
  supplied 0% rate produces a zero-interest estimate without a duration.
- Each liability row shows its own estimated total interest using the same
  assumptions. Rows without enough APR or duration data show the estimate as
  unavailable, and the bar tooltip repeats the amount.
- Future saved maturity dates take precedence. Without a maturity date,
  duration is estimated using constant APR and monthly payment amortization.
  Zero APR uses balance divided by payment. Estimates assume no fees, new
  borrowing, or payment/rate changes.
- Missing inputs, non-amortizing payments, or stale/invalid maturity dates
  produce an unknown duration, not a fabricated payoff bar. Zero balances
  are marked paid off.
- Remaining-month inputs provide temporary planning adjustments. Reset or
  leaving the page restores the source-derived calculation. They do not
  alter saved loans or establish a new repayment agreement. The input column
  is labeled “Months left.” Each row shows the saved maturity date when known,
  or an estimated ending month below the input; a missing duration prompts
  the user to add months.
- The header displays total interest owed, not an estimated-current-month interest card. It sums the available per-debt estimates; the note identifies how many debts could not be estimated. Unknown APR is never zero; an explicit zero APR can produce $0 total interest even without a known duration.
- Avalanche, Snowball and Longest Duration sorting reorder the same debts
  without changing their values or the chart's time scale.

## Bubble view

- The Gantt/Bubbles toggle is right-aligned beside the balance/interest totals. Both views use the same debts and planning-duration overrides.
- **Debt landscape** replaces the Gantt **Exposure matrix** header. It uses matching title/subtitle/legend typography and a single bubble legend; Gantt sorting is hidden.
- The plot has two axes: remaining months (X) and APR (Y). Flat 2D circles have area proportional to balance, APR-severity fills, and no outlines.
- Initial load and Reset use axis maximums 10% above the highest plotted months and APR, with nonzero fallback bounds where necessary.
- Pan/zoom changes the plotted coordinate window inside fixed axes, not account data. Controls include zoom in/out and a reset-arrow icon; dragging, wheel/pinch and keyboard navigation are supported.
- Details appear near the selected/hovered bubble, repositioned within chart bounds rather than pinned to a corner.
- Accounts without usable duration/APR are omitted from the plot, not from debt balances. The compact “Not shown in the plot” list gives each name and parenthesized balance, APR and months; missing values are labeled unknown.
- Update APRs through account management and temporary months in Gantt. Bubble interaction never edits saved accounts or interest assumptions.

## Verification

Calculation tests:

```sh
npx tsx --test client/src/lib/liability-map.test.ts
```

Run the complete model, Gantt, and bubble regression suite with `npm run test:liability-map`.

Rendered-component tests use isolated in-memory query data, not sign-in bypasses:

```sh
npx esbuild client/src/pages/liability-map.test.ts --bundle --platform=node --format=cjs --packages=external --jsx=automatic --outfile=/tmp/liability-map-ui.test.cjs
NODE_PATH="$PWD/node_modules" node --test /tmp/liability-map-ui.test.cjs
```

The rendered tests verify shared-scale bar geometry, severity boundaries,
accessible exact values, default ordering, missing-term/paid-off states and
empty-state navigation. They do not exercise browser interaction or visually
inspect the authenticated page.
