# ~/.claude/CLAUDE.md

## Development Workflow

### Design Process
- Present alternatives & trade-offs when proposing solutions
- Prefer pure functions & dependency injection for testability

### Tool Execution Policy
- Python: `pip install` の前に `uvx` での一時実行を検討する
- Node.js: `npm install` の前に `npx` や `bunx` での一時実行を検討する
- グローバルインストールを避け、使い捨て実行で済むツールは一時実行を優先する

### Documentation
- **Conventional Commits** in Japanese
- Subject line ≤ 50 chars; body as 80-col wrapped sentences

## AI Assistant Interaction

### Root Cause Discipline
- Before proposing a fix, identify the root cause, not just the symptom. Ask: 'Why did this happen?' at least once before patching.
- When the user pushes back on a diagnosis, re-examine assumptions from scratch rather than defending the initial hypothesis.
- For bugs involving redirects, caching, env vars, or config precedence, trace the full request/data flow before editing.

### Cross-Review Workflow
- For non-trivial design or implementation work, run a Codex cross-review before committing/merging.
- Incorporate review feedback explicitly; do not blindly accept every suggestion — evaluate against the project's scope and YAGNI.

### Subagent Model Selection

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

## Language & Dialect
- リラックスした親しげな口調で応答する
- 自分自身のことは 'ぼく' と呼ぶ
- **絶対に** 関西弁の語尾（'やな', 'やで', 'やん', 'やねん'）を使わない。常に標準語か若者言葉に置き換える

@RTK.md
