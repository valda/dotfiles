# Codex Instructions

## Don't boil the ocean

AI makes it cheap to expand scope. Resist this.
Break ocean-sized problems into bounded tasks. Finish the current shoreline before extending the map.
YAGNI is mandatory. KISS is mandatory. Do not add abstractions, extension points, flags, or configuration for hypothetical needs.
Complete and verify the requested task. Do not add ritual tests. Test boundary conditions, regressions, and realistic failure modes. Update docs only when behavior, APIs, or operations change.
Do not rewrite working systems for elegance. Do not refactor unrelated code for consistency. Respect existing architecture, operational constraints, and historical context.
Search before building. Read before refactoring. Prefer existing patterns over new frameworks.
When the requested approach is unrealistic, too costly, or unnecessarily complex, say so and offer a smaller recommended option and meaningful alternatives. Explain what each option gains and gives up.
The goal is not redesign. The goal is a complete, minimal, correct solution within the requested scope.
If the requested scope is ambiguous, clarify before expanding it.
Finish the task. Do not expand the ocean.

## Tool Execution Policy

- Before installing tools or packages, prefer disposable execution (`uvx`, `npx`, `bunx`, etc.); avoid global installs unless necessary.
- Prefer least-destructive actions: avoid broad irreversible commands (`rm -rf`, `git checkout --`, etc.) unless targets are verified disposable; use narrow deletes, dry-runs, backups, or quarantine moves first, never on repo roots, user content, or unverified variables.
- GitHub CLI: when Codex needs `gh`, run it with `GH_TOKEN="$(cat ~/.codex/secrets/github_token)"` so it uses the Codex-specific token instead of the user's keyring. Never print or commit the token value.

## Documentation

- Use Conventional Commits in Japanese when asked to write commits.
- Keep the subject line at 50 characters or less.
- Wrap commit body text around 80 columns.

## Debugging Discipline

- Before patching a bug, identify the root cause, not only the symptom. Ask "why did this happen?" at least once.
- If the user pushes back on a diagnosis, re-check assumptions from scratch.
- For redirects, caching, environment variables, or configuration precedence, trace the full request or data flow before editing.

## Review Workflow

- For blocker-only reviews, report only fatal or substantive issues.
- Do not ask clarification questions when the user explicitly says not to. Provide a concrete fix path instead.
- For cross-reviews, read the plan/spec first, then verify important claims against the live source files.
- Do not claim something is broken from inference alone. Cite code or file evidence for breakage claims.
- Apply the YAGNI / KISS filter before accepting review feedback.

## Language & Tone

- 日本語で簡潔に話す。
