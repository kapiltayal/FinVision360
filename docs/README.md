# FinVision360 documentation

Reviewed against repository code: **2026-10-18**.

These guides describe the implemented application, not a fresh inspection of production data, live DNS, or a new security audit. Dated operational evidence remains labeled with its original date.

## Guides

| Document | Covers |
| --- | --- |
| [Architecture](FinVision360_Architecture.md) | Stack, routing, Supabase authentication, ownership isolation, logging, code map and commands |
| [Database schema](Database_schema_tables.md) | Tables, views, columns, relationships, migrations and rate nullability |
| [Transaction ingestion and processing](Transaction_ingestion_%26_processing.md) | File/Plaid/manual flows, visible flowcharts, merchant matching, AI classification, duplicates and persistence |
| [Budget Planning](Budget_Planning.md) | Live suggestions, saved plans, immutable historical closes and goal snapshots |
| [Goal Allocation](Goal_Allocation.md) | Account-to-goal earmarking, legacy progress, limits, deficits and budget effects |
| [Retirement Planner](Retirement_Planner.md) | Independent projection inclusion, custom items, reset behavior and assumptions |
| [Liability Map](Liability_Map.md) | Gantt/bubble views, duration, amortized interest, missing inputs and pan/zoom |
| [AI Lab](AI_Lab.md) | Prompts, model/provider, financial context, streaming and archives |
| [Pricing](Pricing_page.md) | Four plan definitions, editable comparison factors and signed-in/out actions |
| [Public pages](Public_Pages.md) | Marketing headers, carousel, signup and contact form |
| [Feedback and contact notifications](Resend_feedback_notifications.md) | Save-first behavior, dedicated Resend account, historical DNS instructions and failure handling |
| [Resend DNS setup records](Resend_DNS_records.txt) | Previously retrieved sending-domain records; verify in the dedicated account before changing DNS |
| [Dependency security review](Dependency_security_review.md) | Dated advisory evidence, styling upgrade, SheetJS scanner findings and regression commands |

## Reading the ingestion flowcharts

The ingestion guide embeds three SVG files from [diagrams/](diagrams/). Standard Markdown image support is sufficient; no Mermaid renderer or external service is required. Numbered steps remain readable in plain-text viewers. Mermaid source is retained in collapsible sections for editing.

## Maintaining these documents

- Verify behavior against the relevant UI, route/service, shared schema, and startup SQL together.
- Keep diagrams, numbered steps and optional Mermaid source aligned when an import path changes.
- Preserve the distinction between implemented features, advertised pricing, assumptions and historical audit evidence.
- Do not include secret values, sample passwords, access tokens, or unverified production-state claims.
- Validate relative links from each document's directory. Filenames containing `&` are percent-encoded in links.
- Generated build output and uploaded screenshots are not the source of truth for behavior.

Application changes were not made by this documentation refresh.
