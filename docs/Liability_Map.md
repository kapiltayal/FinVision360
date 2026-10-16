# Liability Map

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
- Future saved maturity dates take precedence. Without a maturity date,
  duration is estimated using constant APR and monthly payment amortization.
  Zero APR uses balance divided by payment. Estimates assume no fees, new
  borrowing, or payment/rate changes.
- Missing inputs, non-amortizing payments, or stale/invalid maturity dates
  produce an unknown duration, not a fabricated payoff bar. Zero balances
  are marked paid off.
- Remaining-month inputs provide temporary planning adjustments. Reset or
  leaving the page restores the source-derived calculation. They do not
  alter saved loans or establish a new repayment agreement.
- Monthly interest is an estimate of current balance × APR ÷ 12, not lifetime
  interest. Unknown APR accounts are explicitly excluded from that summary.
- Avalanche, Snowball and Longest Duration sorting reorder the same debts
  without changing their values or the chart's time scale.

## Verification

Calculation tests:

```sh
npx tsx --test client/src/lib/liability-map.test.ts
```

Rendered-component tests use isolated in-memory query data, not sign-in bypasses:

```sh
npx esbuild client/src/pages/liability-map.test.ts --bundle --platform=node --format=cjs --packages=external --jsx=automatic --outfile=/tmp/liability-map-ui.test.cjs
NODE_PATH="$PWD/node_modules" node --test /tmp/liability-map-ui.test.cjs
```

The rendered tests verify shared-scale bar geometry, severity boundaries,
accessible exact values, default ordering, missing-term/paid-off states and
empty-state navigation. They do not exercise browser interaction or visually
inspect the authenticated page.
