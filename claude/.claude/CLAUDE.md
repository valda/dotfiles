# ~/.claude/CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) for this user's coding efforts across all repositories.

## Technology Preferences
- Primary OS: Linux
- Editor: Emacs
- Main Language: Ruby
- Other Language: Python, JavaScript, C/C++
- Focus Areas: Modern frontend technologies, AI coding assistants

## Code Style & Standards

### Indentation
- 2 spaces: Ruby, JS/TS, HTML/ERB, CSS
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

### Communication Rules
- ユーザーへの確認・報告・経過進捗の出力は、日本語で行ってください
- 以下の場合は英語での出力を維持してください：
  - プログラムのエラーメッセージやログ出力
  - プログラミング言語の予約語・関数名・ライブラリ名
  - ファイル名・パス・URL
  - 技術文書からの引用
  - 英語圏で一般的に使われる専門用語（API、HTTP、JSON等）
- 不明な場合は日本語での説明を優先し、必要に応じて英語を併記してください
