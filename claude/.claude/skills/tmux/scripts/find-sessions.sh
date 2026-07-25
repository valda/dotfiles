#!/usr/bin/env bash
set -euo pipefail

socket=""
all=0
default_server=1
query=""

usage() {
  cat >&2 <<'EOF'
Usage: find-sessions.sh [-S SOCKET] [--all] [--no-default] [-q QUERY]

List tmux sessions/panes. With no socket options, lists the default server
(the user's own tmux). Output includes pane ids (%N) for stable targeting.

Options:
  -S, --socket     inspect one tmux socket path
  --all            also scan ${CLAUDE_TMUX_SOCKET_DIR:-${TMPDIR:-/tmp}/claude-tmux-sockets}/*.sock
  --no-default     skip the default server
  -q, --query      filter output by fixed substring (e.g. ssh, pry, rails)
  -h, --help       show help
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    -S|--socket) socket=${2:-}; default_server=0; shift 2 ;;
    --all) all=1; shift ;;
    --no-default) default_server=0; shift ;;
    -q|--query) query=${2:-}; shift 2 ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown argument: $1" >&2; usage; exit 2 ;;
  esac
done

if ! command -v tmux >/dev/null 2>&1; then
  echo "tmux not found on PATH" >&2
  exit 127
fi

FORMAT='  #{session_name}:#{window_index}.#{pane_index} id=#{pane_id} command=#{pane_current_command} title=#{pane_title} #{?pane_active,active,}'

list_one() {
  # $1: ラベル, 残り: tmux コマンドプレフィックス
  # セッションを 1 つ以上列挙できたときだけ 0 を返す（呼び出し側の found 判定に使う）
  local label=$1; shift
  if ! "$@" list-sessions >/dev/null 2>&1; then
    return 1
  fi
  echo "$label"
  local output
  output=$("$@" list-panes -a -F "$FORMAT" 2>/dev/null || true)
  if [[ -n "$query" ]]; then
    grep -F -- "$query" <<<"$output" || true
  else
    printf '%s\n' "$output"
  fi
}

found=0

if [[ "$default_server" -eq 1 && -z "$socket" ]]; then
  if list_one "SERVER default" tmux; then found=1; fi
fi

if [[ -n "$socket" ]]; then
  if list_one "SOCKET $socket" tmux -S "$socket"; then found=1; fi
fi

if [[ "$all" -eq 1 ]]; then
  socket_dir=${CLAUDE_TMUX_SOCKET_DIR:-${TMPDIR:-/tmp}/claude-tmux-sockets}
  if [[ -d "$socket_dir" ]]; then
    while IFS= read -r -d '' sock; do
      if list_one "SOCKET $sock" tmux -S "$sock"; then found=1; fi
    done < <(find "$socket_dir" -maxdepth 1 -type s -print0 2>/dev/null || true)
  fi
fi

if [[ "$found" -eq 0 ]]; then
  echo "No tmux sessions found."
fi
