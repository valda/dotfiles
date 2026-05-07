---
name: ast-grep
description: "Use ast-grep for fast structural code search, review, and safe rewrites during coding tasks. Trigger between rg and heavier semantic tools/LSP: when textual search is too broad or fragile, but full symbol-aware navigation is unnecessary; when matching syntax rather than strings matters; when planning or verifying codemods; when finding API usages with variable arguments; or when testing reusable YAML rules with ast-grep scan."
---

# ast-grep

## Overview

Use `ast-grep` when the task depends on code structure: function calls,
assignments, class/module definitions, imports, callbacks, conditionals, or
syntax-aware rewrites.

Treat it as the fast middle layer between `rg` and heavier semantic tools/LSP:

- Use `rg` first for broad text, filename, and cheap keyword discovery.
- Use `ast-grep` when the next question is syntactic shape, such as "calls to
  this method with any arguments", "this assignment form", or "callbacks of
  this kind".
- Use LSP or another symbol-aware tool only when symbol identity,
  definitions/references, type-aware context, rename safety, or cross-file
  semantic navigation matters.

Prefer the installed `ast-grep` command. In this environment it may be available
as `ast-grep` (alias `sg`); do not install another copy unless the command is
missing and the user asks for setup work.

## Workflow

1. Start with intent and language.
   Identify the language flag (`--lang ts`, `--lang ruby`, `--lang python`,
   etc.) and the smallest path that should be searched. If only a keyword is
   known, use `rg` first to discover likely files or names.

2. Probe read-only first.
   Use `ast-grep run --pattern ... --lang ... <path>` and inspect matches
   before proposing or applying a rewrite. Add `--json=stream`,
   `--files-with-matches`, or `-C <n>` when that makes review easier.

3. Escalate to LSP or a symbol-aware tool when identity matters.
   If the match set depends on whether two same-named methods are actually the
   same symbol, whether a call resolves through inheritance/imports, or whether
   a change is type-safe, use LSP or another symbol-aware tool after narrowing
   candidates with `ast-grep`. Do not assume Serena is available.

4. Debug the pattern if matches look wrong.
   Use `--debug-query=ast` or `--debug-query=pattern` with an explicit
   `--lang` to see how ast-grep parses the query. If the pattern is ambiguous
   or not valid parseable code, give it more syntactic context.

5. Rewrite conservatively.
   For one-off rewrites, first run with `--rewrite` without `--update-all` to
   inspect the diff. Use `--interactive` for selective edits, or `--update-all`
   only after the match set is clearly correct and scoped.

6. Use YAML rules for non-trivial logic.
   When a pattern needs constraints, relational rules, multiple documents, or a
   reusable codemod, create a temporary or repo-local rule file and run
   `ast-grep scan --rule <rule.yml> <path>`. Do not add persistent
   `sgconfig.yml`, rule directories, or CI wiring unless the task needs them.

7. Validate with project tests after edits.
   `ast-grep` proves structural selection, not behavior. Run the relevant test,
   typecheck, lint, or focused command expected for the repository.

## Command Patterns

Find a call shape:

```bash
ast-grep run --lang ts --pattern 'console.log($$$ARGS)' app/
```

Find repeated receiver use:

```bash
ast-grep run --lang ruby --pattern '$OBJ.$METHOD($$$ARGS)' app/models
```

Preview a rewrite:

```bash
ast-grep run --lang ts --pattern '$A && $A()' --rewrite '$A?.()' src/
```

Apply a confirmed rewrite:

```bash
ast-grep run --lang ts --pattern '$A && $A()' --rewrite '$A?.()' --update-all src/
```

Inspect only files with matches:

```bash
ast-grep run --lang ruby --pattern 'before_action $METHOD' --files-with-matches app/controllers
```

Use a single YAML rule without project setup:

```bash
ast-grep scan --rule /tmp/rule.yml app/
```

## Pattern Notes

- Patterns must be valid code in the selected language. If a fragment does not
  parse, wrap it in enough surrounding syntax to make it parse.
- `$NAME` matches one AST node. Use uppercase, underscores, and digits for named
  meta variables, such as `$ARG` or `$METHOD`.
- `$_` is useful for an uncaptured single-node wildcard.
- `$$$ARGS` matches zero or more AST nodes, commonly arguments, parameters, or
  statements.
- Reusing the same captured meta variable requires the same syntax to appear
  again, for example `$A == $A`.
- Use `--globs` to narrow file sets when language inference or repository shape
  is noisy.

## YAML Rule Skeleton

Use YAML when simple `--pattern` is not expressive enough:

```yaml
id: descriptive-rule-id
language: TypeScript
severity: warning
message: Describe the structural issue.
rule:
  pattern: Promise.all($A)
  has:
    pattern: await $_
    stopBy: end
```

For rewrites:

```yaml
id: rename-call
language: Python
rule:
  pattern: old_name($$$ARGS)
fix: new_name($$$ARGS)
```

Run it with:

```bash
ast-grep scan --rule /tmp/rule.yml path/to/check
```

## Guardrails

- Do not treat ast-grep results as a complete semantic proof. It is a structural
  matcher; follow up with code reading and tests.
- Do not apply `--update-all` across the whole repository until a read-only run
  has shown the exact intended match set.
- Keep temporary rule files in `/tmp` unless the repository needs a durable
  codemod or lint rule.
- Prefer the smallest pattern that expresses the requirement. If a broad pattern
  produces many false positives, add syntax context or a YAML rule constraint
  before editing.
