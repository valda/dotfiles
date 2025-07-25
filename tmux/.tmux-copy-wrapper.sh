#!/bin/bash

# 使用例：
#   echo "コピーしたい文字列" | ~/.tmux-copy-wrapper.sh        ← コピー
#   ~/.tmux-copy-wrapper.sh --paste                            ← ペースト（複数行OK）
#   ~/.tmux-copy-wrapper.sh --paste-oneline                    ← 改行なしでペースト（実行防止モード）

set -e

is_wsl() {
  grep -qi microsoft /proc/version
}

is_wayland() {
  [ -n "$WAYLAND_DISPLAY" ] && command -v wl-copy >/dev/null
}

is_x11() {
  command -v xsel >/dev/null
}

is_remote() {
  [ -n "$SSH_CONNECTION" ] || [ -n "$SSH_CLIENT" ] || [ -n "$SSH_TTY" ]
}

supports_osc52() {
  # ターミナルがOSC 52対応しているかチェック
  case "$TERM" in
    alacritty|xterm-*|tmux-*) return 0 ;;
  esac
  [ -n "$TMUX" ] && return 0  # tmux経由なら基本的にOK
  return 1
}

osc52_copy() {
  local content
  content=$(cat)
  printf '\033]52;c;%s\a' "$(echo -n "$content" | base64 | tr -d '\n')"
}

# メイン処理
if is_remote && supports_osc52; then
  case "$1" in
    --paste|--paste-oneline)
      echo "Remote paste not supported via OSC 52" >&2
      exit 1
      ;;
    *) osc52_copy ;;
  esac
elif is_wsl; then
  case "$1" in
    --paste) powershell.exe -Command "[Console]::Out.Write((Get-Clipboard))" | tr -d '\r' ;;
    --paste-oneline) powershell.exe -Command "[Console]::Out.Write((Get-Clipboard))" | tr -d '\r\n' ;;
    *) clip.exe ;;
  esac
elif is_wayland; then
  case "$1" in
    --paste) wl-paste --no-newline ;;
    --paste-oneline) wl-paste --no-newline | tr -d '\n' ;;
    *) wl-copy ;;
  esac
elif is_x11; then
  case "$1" in
    --paste) xsel -o -b ;;
    --paste-oneline) xsel -o -b | tr -d '\n' ;;
    *) xsel -i -b ;;
  esac
else
  echo "No clipboard backend available." >&2
  exit 1
fi
