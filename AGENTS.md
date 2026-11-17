# Mutiara Florist Management System (MFMS) — Agent Guidelines

## UI/UX & Anti-Slop Rules (Project Scope)

For any UI, copywriting, accessibility, or responsive layout task in this repository:

1. Read `docs/DESIGN.md` first for visual direction, color tokens, typography, and component rules.
2. Follow the project-installed Anti-Slop skills in `.agents/skills/`:
   - `.agents/skills/antislop/SKILL.md` (core filter, R-01 to R-40, Delivery Gate)
   - `.agents/skills/antislop-ui/SKILL.md`
   - `.agents/skills/antislop-human/SKILL.md` (WCAG AA contrast checker: `.agents/skills/antislop-human/contrast-check.py`)
   - `.agents/skills/antislop-layoutmobile/SKILL.md`
   - `.agents/skills/antislop-copywriting/SKILL.md`
3. Preserve all MFMS business invariants (`docs/BUSINESS_RULES.md`, `docs/PRICING_AND_SHIPPING.md`): integer Rupiah math, server-calculated totals, linear item fulfillment, idempotent payments/expenses, and POSTED/VOIDED audit integrity.
