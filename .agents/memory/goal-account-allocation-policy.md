---
name: Goal account allocation policy
description: Confirmed semantics for legacy goal funding, account deficits, completion and budget integration.
---

Goal allocation is a virtual earmark, never a bank transfer. Existing manually entered goal progress must remain separate legacy funding until the user maps it; never infer its source account. Mapping may be partial and must preserve total funded value.

**Why:** The user explicitly chose preservation of legacy funding rather than discarding it or guessing its source.

**How to apply:** Use legacy plus linked funding for progress and live savings requirements. Keep historical closes frozen at capture time.

Goals below target are active; funded goals belong in a completed section but must retain editable allocations. New allocations stop at remaining goal target and account availability. Balance drops preserve allocations, show deficits, and block additional over-allocation rather than silently redistributing.

**Why:** These were explicit user decisions during planning; account sync must not change the user's earmarks without consent.

**How to apply:** Allow reductions and releases even when an account is in deficit; account/goal deletions must explain and confirm allocation release. Allocations are not income or spending, and must not overwrite saved budget plans.

Use a planning/notepad icon consistently to identify allocations, including individual goal funding entries, rather than a chain-link icon.

**Why:** The user explicitly clarified that allocation represents a plan, not a transfer, and corrected inconsistent symbols between the legend and goal entries.

**How to apply:** When adding allocation UI, keep its identifying symbols consistent across legends, cards, and allocation entries.
