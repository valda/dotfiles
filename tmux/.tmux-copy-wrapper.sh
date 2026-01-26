#!/bin/bash

# OSC52を使用したクリップボードラッパー
# コピー: OSC52でターミナル経由でシステムクリップボードに送信
# ペースト: tmuxバッファから取得
#
# 使用例：
#   echo "コピーしたい文字列" | ~/.tmux-copy-wrapper.sh        ← コピー
#   ~/.tmux-copy-wrapper.sh --paste                            ← ペースト（複数行OK）
#   ~/.tmux-copy-wrapper.sh --paste-oneline                    ← 改行なしでペースト

set -e

osc52_copy() {
  local content
  content=$(cat)
  # tmux内ならtmuxのパススルーを使用
  if [ -n "$TMUX" ]; then
    printf '\033Ptmux;\033\033]52;c;%s\033\033\\\033\\' "$(echo -n "$content" | base64 | tr -d '\n')"
  else
    printf '\033]52;c;%s\033\\' "$(echo -n "$content" | base64 | tr -d '\n')"
  fi
}

case "$1" in
  --paste)
    tmux save-buffer -
    ;;
  --paste-oneline)
    tmux save-buffer - | tr -d '\n'
    ;;
  *)
    osc52_copy
    ;;
esac
