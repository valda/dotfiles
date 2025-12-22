# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

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

# Alternative Python symlink manager
python make_symlinks.py [--force]
```

### Git Workflow
- Use conventional commits in Japanese (as specified in user's global CLAUDE.md)
- Example: `feat(hypr): Hyprlandの設定を更新`

## Architecture & Organization

### Stow Package Structure
Each directory is a "stow package" that mirrors the home directory structure:
- Direct dotfiles: `package/.dotfile` → `~/.dotfile`
- XDG config: `package/.config/app/` → `~/.config/app/`

### Core Packages
- **hypr/**: Hyprland compositor config with custom scripts
- **waybar/**: Status bar configuration and styling
- **zsh/**: Shell config with starship prompt integration
- **vim/**: Editor configuration
- **git/**: Global gitignore
- **claude/**: User's Claude AI configuration

### Important Files
- `stow-all.sh`: Main installation script
- `make_symlinks.py`: Alternative symlink manager
- `hypr/.config/hypr/scripts/`: Custom Hyprland helper scripts
- `claude/.claude/CLAUDE.md`: User's global Claude preferences (already symlinked to ~/.claude/)

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