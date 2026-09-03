# Domain Docs

How the engineering skills should consume this repo's domain documentation when exploring the codebase.

## Before exploring, read these

- **`CONTEXT.md`** at the repository root.
- **`docs/adr/`** for decisions relevant to the area being changed.

If these files don't exist, proceed silently. The domain-modeling workflow creates them when terms or decisions are resolved.

## File structure

This is a single-context repository:

```
/
├── CONTEXT.md
├── docs/adr/
└── src/
```

## Use the glossary's vocabulary

When output names a domain concept, use the term defined in `CONTEXT.md`. Avoid synonyms the glossary explicitly rejects.

## Flag ADR conflicts

If output contradicts an existing ADR, surface the conflict explicitly rather than silently overriding it.
