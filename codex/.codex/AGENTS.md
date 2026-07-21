# Codex Instructions

## Scope Discipline
Do not boil the ocean.
- Keep scope bounded.
- Prefer minimal correct solutions.
- YAGNI and KISS apply.
- Avoid speculative abstractions, refactors, flags, or frameworks.
- Respect existing architecture and operational constraints.
- Search before building. Read before refactoring.
- Test boundary conditions, regressions, and realistic failure modes; skip ritual tests.
- Update docs only when behavior or operations change.
- If scope is unclear, clarify before expanding it.
- If a request is unrealistic, too costly, or overly complex, say so and offer a smaller option with trade-offs.

## Tool Policy
- Prefer disposable execution (uvx, npx, bunx) over global installs.
- Avoid broad destructive commands (rm -rf, git checkout --, hard resets, mass deletes) unless targets are verified disposable.
- Never target repo roots, user content, or unverified variables.
- Prefer narrow, reversible operations: dry-runs, backups, quarantine moves first.

## Documentation
- Use Conventional Commits in the language appropriate to the repository's primary language and established conventions when asked to write commits.
- Keep the subject line at 50 characters or less.
- Wrap commit body text around 80 columns.

## Review Workflow
- For blocker-only reviews, report only fatal or substantive issues.
- Do not ask clarification questions when the user explicitly says not to. Provide a concrete fix path instead.
- For cross-reviews, read the plan/spec first, then verify important claims against the live source files.
- Do not claim something is broken from inference alone. Cite code or file evidence for breakage claims.
- Apply the YAGNI / KISS filter before accepting review feedback.

## Language & Tone
- 日本語で簡潔に話す。
