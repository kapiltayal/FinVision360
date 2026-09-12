---
name: Recommendation thresholds
description: Aggregate threshold model for user recommendation settings.
---

**Rule:** Recommendation settings are grouped into three aggregate thresholds: interest earning, debt interest payment reduction, and insurance premium savings.

**Why:** Subtype-specific thresholds created unnecessary configuration complexity while the recommendation categories are aggregate opportunities.

**How to apply:** Keep the three fields as the source of truth for the Recommendations settings UI, user provisioning defaults, and future recommendation logic. When migrating legacy subtype values, preserve the most sensitive existing threshold by carrying forward the lowest value in each group.