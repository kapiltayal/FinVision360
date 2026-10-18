# Goals and Goals Allocation

Reviewed against repository code: **2026-10-18**. [Documentation index](README.md).

## Responsibilities and layout

The Goals & Tracking navigation has two destinations. **Goals** manages goal creation, editing and deletion; **Goals Allocation** links existing goals to physical accounts. The Add Goal header belongs only to Goals. New/edit goal forms do not ask for current progress, and individual goal cards no longer have an Update Progress action.

Allocation shows checking, savings and cash accounts on the left and active, below-target goals on the right. Compact cards leave room for smooth connection lines; each account has its own line color, shared across all of its goal connections. The planning/notepad symbol means **an allocation is a plan, not a transfer**. Drag an account onto a goal or use the assign action, then enter/edit the allocation amount. Account cards show total and unallocated cash; goal cards show funded amounts. Completed goals appear separately.

## Funding and persistence

- `goal_allocations` stores a user-owned many-to-many account/goal relationship with one positive amount per pair. Both ends must belong to that user.
- `user_goals.current_amount` retains legacy, unmapped progress. It is not assumed to come from any particular account.
- `goal_funding` is a database view, not another balance store: **funded = legacy amount + sum of allocations**.
- Mapping legacy progress to an account consumes the selected legacy amount rather than adding it twice.
- Writes are validated and serialized with a per-user database lock, preventing concurrent assignments from bypassing limits.
- New/increased funding cannot exceed the account's available cash or the goal's remaining target.
- If an account balance falls below its existing allocations, retain those allocations, show the deficit, and block further over-allocation. Do not redistribute cash silently.
- Removing an allocation releases earmarked cash; it does not move money or create a transaction.
- Deleting an account or disconnecting a linked account with allocations requires explicit allocation-removal confirmation. Removing that source reduces funded progress; it does not manufacture legacy funding.

## Budget and history boundaries

Allocations change the live goal savings requirement, not income/expense actuals or account balances. Unsaved budget suggestions use combined funding, while saved plan values—including zero—remain authoritative. Viewing Goals or a budget does not silently save defaults.

New goal-history rows and monthly budget closes capture combined funding and the monthly savings requirement at snapshot time. Older snapshots are not rewritten. Historical budget reads never consult current allocations to recompute the old requirement.

## Implementation and verification

- `server/goal-allocation.ts`: additive schema/view, locking, validation and mutations.
- `server/routes.ts`, `server/storage.ts`: goal/allocation APIs and combined funding reads.
- `client/src/pages/goals.tsx` and allocation components under `client/src/components/`: management and linking UI.
- `server/goal-history.ts`, `server/monthly-backup.ts`: archived funding and savings.
- `npm run test:goal-allocation`: dedicated regression suite. Database integration checks require an intentionally selected development/test database; do not run fixture mutations against production.

See [Budget Planning](Budget_Planning.md) and [Database schema](Database_schema_tables.md).
