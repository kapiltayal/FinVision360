# AI Lab: How Questions Become Responses

*Implementation guide, verified against the application code on October 8, 2026.*

> **Short version:** The browser sends an authenticated request to the app server. The server loads a small, user-specific financial context, combines it with the question and safety instructions, sends that prompt to the configured model, streams the answer back, and saves the completed question and response in that user's AI Archives.

## Request-to-response flow

```text
AI Lab page
    │ authenticated POST
    ▼
FinVision360 server ── loads only the signed-in user's permitted data
    │ system instructions + question + selected financial summary
    ▼
Replit-managed OpenAI-compatible API ── model: gpt-5.6-luna
    │ streamed response chunks
    ▼
FinVision360 server ── streams chunks to the browser; saves completed answer
    ▼
AI Lab response view and that user's AI Archives
```

The model does **not** connect to the application database. The server is the boundary: it chooses and formats the information included in each request.

## What data each AI Lab request sends

All AI Advisor endpoints require authentication. The server uses the signed-in user's ID when it reads records, then sends only the context described below.

| AI Lab tool | User input | Financial context sent to the model |
|---|---|---|
| **Ask Whizzy / scenario analysis** | The user's question or scenario. | Asset total, debt total, calculated net worth; up to 100 assets with name, category, value, and interest rate; up to 100 liabilities with name, category, balance, interest rate, and minimum payment; and, if available, retirement context. |
| **Debt Strategy** | The monthly budget available for extra debt payments. | Up to 100 of the user's liabilities, with name, category, balance, interest rate, and minimum payment. It does not send the user's assets or retirement context. |
| **Net Worth Forecast** | Forecast length in years. | The user's assets and liabilities, plus available retirement context. The forecast length is limited to 1–50 years. |

Retirement context can contain current age, retirement age, 401(k) current balance, annual salary, contribution percentage, and expected return. The retirement age comes from Retirement Planner settings when available; otherwise this context uses age 65. If there is no retirement goal or planner setting, the context is `null`.

### Limits and exclusions

- Ask Whizzy questions are capped at 2,000 characters.
- Asset and liability lists are capped at 100 entries each. Included names and categories are capped at 160 characters per field.
- The complete model input is limited to 28,000 characters; requests exceeding that limit are rejected.
- The model response is limited to 1,800 completion tokens.
- The app does not automatically include the user's name or email.
- These AI Advisor prompts do **not** include transaction rows, bank-account identifiers, spending history, `budget_plans`, or the user's general Goals-page goals. The retirement summary is a separate retirement-specific record.
- Prior questions and archived answers are not added to a new prompt. Each request is built from that request's input and the selected current account data; it is not a continuing chat with the previous archive.

The question itself is sent to the model. Names and labels the user has entered for assets or liabilities may also be included as part of the selected context. Avoid entering passwords, account credentials, or other secrets in a question or financial record.

## Model and provider

The three AI Advisor endpoints use the same model identifier configured in `server/ai/provider.ts`:

**`gpt-5.6-luna`**

The server calls the OpenAI-compatible Chat Completions API through Replit's managed AI integration. The API base URL and credential are read from server-side runtime configuration; they are not sent to the browser. The current advisor routes send system instructions and one user message, with streaming enabled.

The prompts tell the model to treat financial records as reference data—not as instructions—and to provide educational analysis, explain assumptions, avoid guaranteed outcomes, and recommend a qualified professional for significant tax, legal, or investment decisions.

This describes the model identifier in the current application code. Changing that identifier in the provider changes the model used by the advisor routes.

## How answers are streamed and displayed

The browser posts the request to the app server with the user's authentication token. The server calls the model and sends response chunks to the browser as server-sent events. The page appends the text as it arrives, so the user sees the answer develop without waiting for the full response.

### Ask Whizzy

The Ask Whizzy prompt requests these Markdown headings in this order:

1. **Key observations**
2. **Recommendations**
3. **Projected Impact**
4. **Risks**

The page splits the response at those headings and displays the sections in four tabs. While generation is underway, the tabs fill in as streamed text arrives.

### Debt Strategy

The live Debt Strategy answer is displayed as a Markdown response in a scrolling panel. The prompt asks for a comparison of avalanche, snowball, and a custom approach, including debt priority, payoff considerations, and first-six-month guidance.

### Net Worth Forecast

The server has a forecast endpoint that asks for a year-by-year outlook, milestones, conservative/base/optimistic discussion, and actions to improve the outlook. In the current `/ai-advisor` page, the visible tabs are Ask, Debt Strategy, and Archives; there is no forecast input tab there, although forecast responses are supported in the archive data.

### Archives

When a response completes, the server stores the query type, query text, response text, and creation time in `ai_advisor_history`, scoped to the signed-in user. The archive list shows up to the 100 most recent entries. Users can delete one entry or clear their archive.

The archive stores the question and answer, **not a copy of the financial snapshot sent to the model**. It therefore preserves what was asked and answered, but not an exact record of the account values used at that moment. If saving an archive entry fails after generation, the response is still returned to the user.

Archived responses are displayed through the four-section tab component. Ask Whizzy is prompted to use the matching headings. Debt Strategy and forecast prompts do not require those same four headings, so an archived response without matching headings may remain under the first tab rather than being split into the intended sections.

## What this means for users

- The AI receives a limited financial summary selected by the server, not direct access to the user's database.
- The AI can only reason about information actually included in that request. For example, the current Ask Whizzy endpoint does not send transaction history or living-expense categories.
- The user-entered question and generated answer are saved in the user's archive when generation completes.
- The AI response is educational and may be inaccurate or incomplete; users should verify important details and consult qualified professionals before making significant financial decisions.

## Related implementation

- `client/src/pages/ai-advisor.tsx` — input, streaming display, tabs, and archives.
- `client/src/lib/advisor-response.ts` — the four-section response parser.
- `server/routes.ts` — authenticated AI endpoints, user-data context, and archive persistence.
- `server/ai/provider.ts` — model identifier, provider configuration, input limits, and streaming call.
- `shared/schema.ts` — `ai_advisor_history` record shape.
- `client/src/pages/privacy.tsx` — user-facing AI provider and data disclosure.

## Related documentation

- [Historical Budget Plans](historical-budget-plan.md)
