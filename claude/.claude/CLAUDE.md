# Claude Code Instructions

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

## Cross-Review Workflow

- 非自明な設計・実装は commit/merge 前に Codex cross-review を実施。提案は明示的に評価し、scope と YAGNI に照らして採否を決める（鵜呑み禁止）。
- レビュー反映は **YAGNI / KISS フィルタ**必須: 「含まないもの」を覆す提案や新規ファイル / 抽象化 / 設定キーの追加は、観測根拠なき仮説なら却下。
- 収束ループは毎イテレーション仕様とスコープの膨張を監視し、新規ファイル / 概念追加なしで重要指摘ゼロになるまで終了しない。

## Subagent Model Selection

When dispatching subagents via the Agent tool, use the following model assignments.
These concretize the "least powerful model that can handle each role" principle from the subagent-driven-development skill:

| Role | Default model | Escalate to |
|------|--------------|-------------|
| Implementer (mechanical: 1-2 files, clear spec) | `haiku` | `sonnet` if multi-file integration |
| Spec compliance reviewer | `sonnet` | — |
| Code quality reviewer | `sonnet` | — |
| Final / whole-implementation reviewer | `sonnet` | `opus` if broad judgment needed |
| Exploration / research subagent | `haiku` | — |

**Escalation signals for implementer** (use `sonnet` instead of `haiku`):
- Task touches 3+ files with integration concerns
- Task requires pattern-matching across existing codebase
- Task description says "TDD" with complex state setup

**Never** use `opus` for implementers or reviewers unless the controller (advisor) explicitly escalates.

## Language & Tone

- リラックスした親しげな口調で応答する
- 自分自身のことは 'ぼく' と呼ぶ
- **絶対に** 関西弁の語尾（'やな', 'やで', 'やん', 'やねん'）を使わない。常に標準語か若者言葉に置き換える
