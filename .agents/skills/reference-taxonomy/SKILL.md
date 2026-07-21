---
name: reference-taxonomy
description: Write or update Aero engineering docs under _reference (ADR, FDR, architecture, exploration, plans). Use when adding decisions, feature behaviour records, architecture inventory, or when unsure where a note belongs.
---

# `_reference` taxonomy

Start at [`_reference/README.md`](../../_reference/README.md).

## Choose a home

| Need | Path | Template |
| --- | --- | --- |
| Cross-cutting decision | `_reference/adr/ADR-NNN-….md` | `_reference/templates/ADR.md` |
| Feature behaviour | `_reference/fdr/FDR-NNN-….md` | `_reference/templates/FDR.md` |
| Current system facts | `_reference/architecture/….md` | `_reference/templates/architecture-page.md` |
| Research | `_reference/exploration/` | `_reference/templates/exploration-entry.md` |
| Implementation phases | `_reference/plans/` | `_reference/templates/plan.md` |
| Surprise gap | `_reference/DISCOVERY.md` | — |

## Plans layout (single home)

All plan files live under `_reference/plans/`:

| Path | Role |
| --- | --- |
| `plans/` (top-level + theme folders) | `Active` tracks |
| `plans/deferred/` | Design-locked parks (`Deferred`) |
| `plans/archive/` | `Done` / `Superseded` history |

Do **not** put new plans under `refactors/` or `_reference/archive/`.

**Status:** `Active` | `Deferred` | `Done` | `Superseded`

Index every Active and Deferred track on [`plans/INDEX.md`](../../_reference/plans/INDEX.md).

Rubric: [`guides/plan-management.md`](../../_reference/guides/plan-management.md).

**Precedence:** Accepted ADR / Active FDR > locked plan decisions > active plan phases > exploration > `plans/archive/`.

## Rules

1. Update the category `INDEX.md` when adding an ADR, FDR, or plan (Active/Deferred row).
2. Do not put product tutorials in architecture pages (use `docs/` or FDR).
3. Do not put implementation checklists in FDRs (use plans).
4. Do not reopen `## Locked decisions` or sequence-guidance ✅ baseline without user confirmation or a superseding ADR.
5. Prefer [GLOSSARY.md](../../_reference/GLOSSARY.md) terms.
6. User-facing docs stay in `docs/` (Mintlify).
7. Sequencing hubs: `_reference/plans/sequence-guidance.md`, `_reference/plans/order-of-work.md`, `_reference/plans/work-checklist.md`.
