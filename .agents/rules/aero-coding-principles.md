# Aero Agent & Codebase Rules

These rules are distilled from enduring software principles. They guide agent behavior, code review, and architectural decisions in Aero projects.

---

## 1. Separation of Concerns

- Each module addresses a single concern.
- Maintain clear boundaries between responsibilities.

## 2. Make the Wrong Thing Hard, the Right Thing Easy

- Design APIs and conventions to prevent misuse by default.
- Favor structures that guide users toward correct usage.

## 3. Explicit Over Implicit

- Prefer explicit dependencies, data flow, and error handling.
- Avoid global state and action-at-a-distance.
- Clarity is more important than brevity.

## 4. Manage Complexity, Don't Eliminate It

- Distinguish essential from accidental complexity.
- Remove accidental complexity ruthlessly; accept essential complexity.

## 5. Composition Over Inheritance

- Favor small, composable units over deep hierarchies.
- Prefer flat, combinable structures.

## 6. Locality of Behavior

- Code should be understandable in isolation.
- Colocate related logic for easier comprehension.

## 7. Parse, Don't Validate

- Validate inputs at the boundary; operate on known-good data internally.
- Use types/schemas to make illegal states unrepresentable.

## 8. Dependencies Flow Inward

- Core logic must not depend on infrastructure or frameworks.
- Define interfaces in core; satisfy them in outer layers.

## 9. Optimize for Change, Not for Now

- Prioritize readability, replaceability, and small surface areas.
- Avoid premature optimization and over-generalization.

## 10. Fail Fast, Fail Loudly

- Detect and report errors as early as possible.
- Prefer compile-time and startup errors over runtime or silent failures.

## 11. DRY (Don't Repeat Yourself) — But Know When to Stop

- Eliminate duplication of knowledge, not just code.
- Duplicate code is sometimes preferable to premature abstraction.

## 12. Reversibility

- Make decisions easy to undo.
- Prefer thin wrappers, interface boundaries, and small, reversible changes.

---

## Principle Priorities (When in Conflict)

1. **Correctness** — Code must be right.
2. **Clarity** — Code must be understandable.
3. **Simplicity** — Remove accidental complexity.
4. **Safety** — Make invalid states unrepresentable.
5. **Performance** — Optimize only what you measure.
6. **Generality** — Abstract only after repeated need.

---

_These rules are living guidelines. When in doubt, prefer correctness and clarity above all._
