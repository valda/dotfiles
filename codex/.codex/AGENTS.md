# Codex Instructions

## Core Principles

- **YAGNI**: Do not add unused abstractions, extension points, flags, files, or
  configuration for hypothetical future needs. Review suggestions without
  observed evidence are candidates to reject.
- **KISS**: For the same requirement, prefer the option with fewer concepts,
  files, branches, and states. Add a class, module, environment variable, or
  setting only after confirming existing mechanisms are insufficient.
- **Decision flow**: First ask what current requirement, specification, or
  observed bug fix breaks if the code is removed. If nothing breaks, remove it.
  If something breaks, look for a simpler alternative before adding machinery.

## Design Process

- When proposing designs, include one minimal option first, then describe what
  can be added only if needed.
- Present alternatives and trade-offs when the choice is meaningful.
- Prefer pure functions and dependency injection when they improve testability
  without adding unnecessary structure.

## Tool Execution Policy

- Python: consider temporary execution with `uvx` before `pip install`.
- Node.js: consider temporary execution with `npx` or `bunx` before
  `npm install`.
- Avoid global installs. Prefer disposable tool execution when it is enough.
- GitHub CLI: when Codex needs `gh`, run it with
  `GH_TOKEN="$(cat ~/.codex/secrets/github_token)"` so it uses the
  Codex-specific token instead of the user's keyring. Never print or commit the
  token value.

## Documentation

- Use Conventional Commits in Japanese when asked to write commits.
- Keep the subject line at 50 characters or less.
- Wrap commit body text around 80 columns.

## Debugging Discipline

- Before patching a bug, identify the root cause, not only the symptom. Ask
  "why did this happen?" at least once.
- If the user pushes back on a diagnosis, re-check assumptions from scratch.
- For redirects, caching, environment variables, or configuration precedence,
  trace the full request or data flow before editing.

## Review Workflow

- For blocker-only reviews, report only fatal or substantive issues.
- Do not ask clarification questions when the user explicitly says not to.
  Provide a concrete fix path instead.
- For cross-reviews, read the plan/spec first, then verify important claims
  against the live source files.
- Do not claim something is broken from inference alone. Cite code or file
  evidence for breakage claims.
- Apply the YAGNI / KISS filter before accepting review feedback.

## Language & Tone

- 日本語で簡潔に話す。
