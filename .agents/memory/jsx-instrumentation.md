---
name: JSX instrumentation
description: Development metadata injection can cause React.Fragment warnings.
---

Avoid explicit keyed React.Fragment wrappers in this project's development UI; use a real element with display: contents when a keyed group is needed.

**Why:** The development JSX instrumentation injected data-replit-metadata into an explicit Fragment, producing React invalid-prop console warnings. React.Fragment accepts only key and children.

**How to apply:** For grouped mapped menu entries, use a keyed div with className="contents". Reassess if the instrumentation changes; this is a development-tool constraint, not a React restriction on keyed fragments generally.
