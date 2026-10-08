---
name: Goal snapshot savings policy
description: How monthly savings requirements in goal archives relate to live goal and budget calculations.
---

Use the Goals page's definition of monthly savings required for goal backups, rather than introducing a separate calendar-month formula. Archived amounts are point-in-time values and must not be recomputed using today's date or subsequently edited goals.

**Why:** The user requested storing the monthly savings needed alongside monthly goal snapshots; using a different calculation or recomputing later would misrepresent the goal's requirement at backup time.

**How to apply:** Keep the live and backup calculations consistent. Preserve an unavailable requirement for unfinished goals without deadlines rather than equating it with a completed goal's zero requirement.

The development demonstration dataset was explicitly seeded by copying the demo user's current goals into each existing liability-history backup timestamp. Those rows support the demo but are not independently observed historical goal states.

**Why:** The user requested this backfill so goal records would exist at each demo backup date.

**How to apply:** Do not describe those copied values as independently verified point-in-time goals. Keep the distinction between deliberate demo backfill and naturally captured goal history clear when discussing the data.
