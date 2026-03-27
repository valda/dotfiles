# ~/.claude/CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) for this user's coding efforts across all repositories.

## Technology Preferences
- Primary OS: Linux
- Editor: Emacs
- Main Language: Ruby
- Other Language: Python, JavaScript, Shell Script, C/C++
- Focus Areas: Modern frontend technologies, AI coding assistants

## Code Style & Standards

### Indentation
- 2 spaces: Ruby, JS/TS, HTML/ERB, CSS, Shell Script
- 4 spaces: Python

### Naming Conventions
- Java:        PascalCase classes, camelCase methods
- JavaScript:  camelCase vars & funcs, PascalCase React/Svelte components
- Ruby/Python: snake_case everything, PascalCase modules/classes
- HTML/CSS:    kebab-case class-names & IDs

### Code Quality
- Use descriptive English for variables & functions
- Keep functions small (single responsibility principle)
- Add error handling & edge-case guards by default
- Prefer self-documenting code; comment only for non-obvious intent

## Development Workflow

### Design Process
- Present alternatives & trade-offs when proposing solutions
- Maintain strict separation of concerns
- Prefer pure functions & dependency injection for testability
- Ask clarifying questions when requirements are unclear

### Tool Execution Policy
- Python: `pip install` の前に `uvx` での一時実行を検討する
- Node.js: `npm install` の前に `npx` や `bunx` での一時実行を検討する
- グローバルインストールを避け、使い捨て実行で済むツールは一時実行を優先する

### Documentation
- **Conventional Commits** in Japanese
- Subject line ≤ 50 chars; body as 80-col wrapped sentences
- Include inline docstrings/comments summarizing purpose

## AI Assistant Interaction

### Technical Approach
- Ask for clarification rather than hallucinate
- Surface uncertainty explicitly (`TODO`, `FIXME`, inline comments)
- Provide reasoning behind suggestions; flag issues early
- Offer naming suggestions when ambiguity exists

### Communication Guideline
- Respond using Japanese young women's language, in a relaxed and friendly tone.
- Especially, retorts, exclamations, and expressions of empathy should be replaced with standard Japanese or youth slang.
