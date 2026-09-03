## Git workflow

- Use native `git` commands for repository status, diffs, staging, commits, and pushes.
- Do not require or use GitHub CLI (`gh`) for Git operations.
- Do not push code changes directly to `main`.
- For each new code change, create a branch named `{type}/{simple-description}` before committing or pushing, such as `fix/nba-score-refresh` or `feature/world-cup-filters`.
- Stage only files that belong to the requested change; preserve unrelated worktree changes.

## Angular project style

- Follow the official Angular coding style guide: https://angular.dev/style-guide.
- Prefer consistency with the surrounding file when the guide leaves room for judgment.
- Organize code by feature area, not by technical type. Do not introduce generic `components`, `services`, `directives`, `utils`, `types`, or `testing` directories.
- Keep closely related source, template, style, constants, types, and tests together. Split a directory only when it becomes difficult to navigate.
- Keep one primary concept per file and use descriptive, hyphen-separated file names. Avoid generic names such as `utils.ts`, `helpers.ts`, and `common.ts`.
- This project uses the explicit component suffix convention: `name.component.ts`, `name.component.html`, `name.component.scss`, and `name.component.spec.ts` must be sibling files with the same base name.
- Unit tests must be co-located with the code under test and use the same base name followed by `.spec.ts`.
- Put named interfaces and type aliases in a descriptive sibling `*.types.ts` file. Put module-level configuration and lookup constants in a descriptive sibling `*.constants.ts` file.
- Use SCSS for component and global styles. Do not add component CSS files or inline component templates/styles.
- Keep `main.ts` directly under `src` and keep Angular UI code under `src`.

## Angular APIs and signals

- Prefer `inject()` over constructor parameter injection.
- Prefer signal APIs for component contracts and queries: `input()`, `input.required()`, `output()`, `model()`, `viewChild()`, and `viewChildren()`.
- Mark Angular-managed signal properties and queries `readonly`.
- Use writable signals for mutable local UI state and `computed()` for derived state. Do not use `effect()` to propagate or derive state when `computed()` is sufficient.
- Keep RxJS for HTTP, timers, and genuinely event-stream-oriented workflows; do not convert streams to signals unless the signal improves template or state composition.
- Group injected dependencies, inputs, outputs, queries, signals, and computed values before methods.
- Use `protected` for members used only by a component template and `private` for implementation details.
- Prefer direct `class` and `style` bindings over `NgClass` and `NgStyle`.
- Name event handlers for the action they perform rather than the triggering browser event.
- Keep lifecycle hooks small by delegating work to well-named methods, and implement the corresponding lifecycle interfaces.
- Keep components focused on presentation; move reusable transformations and independent business logic into descriptive feature files.
- Keep template expressions straightforward. Move complex derived presentation logic into `computed()` values or focused component methods.

## Agent skills

### Issue tracker

Issues and specs are tracked in GitHub Issues for `netray722/banjitino`. See `docs/agents/issue-tracker.md`.

### Triage labels

Use the default five-role triage vocabulary. See `docs/agents/triage-labels.md`.

### Domain docs

This repository uses the single-context layout. See `docs/agents/domain.md`.
