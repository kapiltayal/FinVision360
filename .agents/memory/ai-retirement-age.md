---
name: AI retirement timeline
description: Source of truth for the retirement age included in AI financial snapshots.
---

The retirement age sent to AI scenario and net-worth forecast prompts must come from the shared Retirement Planner timeline setting, not the separate 401(k) goal retirement age.

**Why:** The Retirement Planner slider is the user-facing shared timeline, and the two stored ages can intentionally differ.

**How to apply:** Keep 401(k) goal values for balance, salary, contribution, and return context, but use planner settings for `retirementAge` in all AI snapshot builders.