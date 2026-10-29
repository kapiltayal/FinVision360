# Spending Benchmarking

The Income & Expenses **Benchmarking** tab is at `/income-expenses/benchmarking`. Both the section tabs and the navigation submenu separate it from Transactions with a small divider.

## Data

User averages come from the existing authenticated `/api/transactions/monthly-averages` endpoint. This uses up to the latest 12 completed calendar months; the page states the exact period. It does not change transactions or plans.

Survey values are from [BLS Consumer Expenditures 2024, Table A](https://www.bls.gov/news.release/archives/cesan_12192025.htm), published December 19, 2025, for all U.S. consumer units. Annual dollars divided by 12 produce monthly benchmarks:

| App category | Survey category | Annual survey dollars |
| --- | --- | ---: |
| Groceries | Food at home | 6,224 |
| Dining Out | Food away from home | 3,945 |
| Entertainment | Entertainment | 3,609 |
| Personal Care | Personal care products and services | 978 |
| Education | Education | 1,569 |

Mappings compare normalized catalog display names. Unknown or renamed categories are not guessed. Income and transfers are excluded. Broad buckets such as Housing, Insurance and Shopping are intentionally not mapped because their scope differs from BLS definitions. Matched monthly dollars, unmatched monthly dollars and coverage make this limitation visible. Missing category activity displays “No recorded charges,” not a claim of zero spending.

These are descriptive national averages, not recommended budgets or personalized peers. Values are not inflation-adjusted or adjusted for household size, income or location. The survey year and source remain explicit rather than silently implying current-year figures.
