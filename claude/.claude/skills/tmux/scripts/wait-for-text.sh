#!/usr/bin/env bash
set -euo pipefail

socket=""
target=""
pattern=""
fixed=0
timeout=15
interval=0.5
lines=1000
tail_only=0

usage() {
  cat >&2 <<'EOF'
Usage: wait-for-text.sh [-S SOCKET] -t TARGET -p PATTERN [-F] [-T SECONDS] [-i SECONDS] [-l LINES] [--tail]

Poll a tmux pane until captured output matches PATTERN.

Options:
  -S, --socket   tmux socket path (omit to use the default server)
  -t, --target   tmux pane target, e.g. session:0.0 or %12
  -p, --pattern  regex pattern to match; use -F for fixed string
  -F, --fixed    treat pattern as a fixed string
  -T, --timeout  timeout in seconds (default: 15)
  -i, --interval poll interval in seconds (default: 0.5)
  -l, --lines    capture this many history lines (default: 1000)
      --tail     match only the last 3 lines (prompt detection)
  -h, --help     show help

Exits 0 on first match, 1 on timeout (last capture printed to stderr).
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    -S|--socket) socket=${2:-}; shift 2 ;;
    -t|--target) target=${2:-}; shift 2 ;;
    -p|--pattern) pattern=${2:-}; shift 2 ;;
    -F|--fixed) fixed=1; shift ;;
    -T|--timeout) timeout=${2:-}; shift 2 ;;
    -i|--interval) interval=${2:-}; shift 2 ;;
    -l|--lines) lines=${2:-}; shift 2 ;;
    --tail) tail_only=1; shift ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown argument: $1" >&2; usage; exit 2 ;;
  esac
done

if [[ -z "$target" || -z "$pattern" ]]; then
  usage
  exit 2
fi

if ! command -v tmux >/dev/null 2>&1; then
  echo "tmux not found on PATH" >&2
  exit 127
fi

tmux_cmd=(tmux)
if [[ -n "$socket" ]]; then
  tmux_cmd=(tmux -S "$socket")
fi

start=$(date +%s)
last_capture=""

while :; do
  if ! last_capture=$("${tmux_cmd[@]}" capture-pane -p -J -t "$target" -S "-$lines" 2>&1); then
    echo "tmux capture-pane failed:" >&2
    printf '%s\n' "$last_capture" >&2
    exit 1
  fi

  haystack=$last_capture
  if [[ "$tail_only" -eq 1 ]]; then
    haystack=$(printf '%s\n' "$last_capture" | sed -e :a -e '/^[[:space:]]*$/{$d;N;ba' -e '}' | tail -3)
  fi

  if [[ "$fixed" -eq 1 ]]; then
    if grep -F -- "$pattern" <<<"$haystack" >/dev/null; then
      exit 0
    fi
  else
    if grep -E -- "$pattern" <<<"$haystack" >/dev/null; then
      exit 0
    fi
  fi

  now=$(date +%s)
  if (( now - start >= timeout )); then
    echo "Timed out waiting for pattern: $pattern" >&2
    echo "--- last captured pane output ---" >&2
    printf '%s\n' "$last_capture" | tail -40 >&2
    exit 1
  fi

  sleep "$interval"
done
