# AGENTS.md

This file provides guidance to AI coding agents working in this repository.

## Repository Overview

This is a GNU Stow-based dotfiles repository managing configuration files for a Linux development environment with Hyprland/Wayland desktop setup.

## Key Commands

### Dotfile Management
```bash
# Install all dotfiles (creates symlinks in $HOME)
./stow-all.sh

# Preview what would be installed (dry run)
./stow-all.sh -n

# Verbose installation (shows what's being linked)
./stow-all.sh -v

# Uninstall all dotfiles
./stow-all.sh -d

# Install specific package only
stow -t ~ package_name
```

### Git Workflow

- Use conventional commits in Japanese when asked to write commits.
- Example: `feat(hypr): Hyprlandの設定を更新`

#### コミット前の機密値チェック

コミットを作成する前に、必ずステージ済み差分を `gitleaks` でスキャンする。

```bash
gitleaks git --staged --redact
```

- `gitleaks` が PATH に無い場合は、ユーザーに通知して中断する。勝手にインストールしない。
- 検出された場合（exit code 1）はコミットを中断し、検出箇所（ファイル・行・ルール ID）をユーザーに報告して指示を仰ぐ。値は redact 済みなので、必要なら staged diff をユーザーが直接確認する。
- 検出値の書き換え・削除は AI が独断で行わない。`gitleaks:allow` コメントの付与や `.gitleaksignore` への追記は、ユーザーの明示的な承認がある場合に限る。

## Architecture & Organization

### Stow Package Structure
Each directory is a "stow package" that mirrors the home directory structure:
- Direct dotfiles: `package/.dotfile` → `~/.dotfile`
- XDG config: `package/.config/app/` → `~/.config/app/`
- `stow-all.sh` treats every top-level directory except `.git` as a Stow package.
  Be careful when adding new top-level directories because they become install
  targets.

### Core Packages

- **hypr/**: Hyprland compositor config with custom scripts
- **waybar/**: Status bar configuration and styling
- **zsh/**: Shell config with starship prompt integration
- **vim/**: Editor configuration
- **git/**: Global gitignore
- **claude/**: Claude Code configuration

### Important Files

- `stow-all.sh`: Main installation script
- `hypr/.config/hypr/scripts/`: Custom Hyprland helper scripts
- `claude/.claude/`: Claude Code configuration, such as `CLAUDE.md` and
  skills, symlinked to `~/.claude/` by Stow.
  `settings.json` is machine-local state such as permissions and plugins, so it
  is not managed by Stow.

## Development Notes

- The repository supports both Wayland (primary) and X11 environments
- Shell configurations work with both bash and zsh
- Ruby development environment is configured (.gemrc, .irbrc, .pryrc)
- Cross-platform support includes Windows/Cygwin configurations (mintty, ahk)

## Working with Configurations

When modifying configs:

1. Edit files directly in their package directories
2. Changes take effect immediately (files are symlinked)
3. Test changes before committing
4. For Hyprland changes: `hyprctl reload` to apply without restart
