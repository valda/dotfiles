#!/bin/bash

# 使用例：
#   echo "コピーしたい文字列" | ~/.tmux-copy-wrapper.sh        ← コピー
#   ~/.tmux-copy-wrapper.sh --paste                            ← ペースト（複数行OK）
#   ~/.tmux-copy-wrapper.sh --paste-oneline                    ← 改行なしでペースト（実行防止モード）

if grep -qi microsoft /proc/version; then
  case "$1" in
    --paste)
      powershell.exe -Command "[Console]::Out.Write((Get-Clipboard))" | tr -d '\r'
      ;;
    --paste-oneline)
      powershell.exe -Command "[Console]::Out.Write((Get-Clipboard))" | tr -d '\r\n'
      ;;
    *)
      clip.exe
      ;;
  esac
else
  case "$1" in
    --paste)
      xsel -o -b
      ;;
    --paste-oneline)
      xsel -o -b | tr -d '\n'
      ;;
    *)
      xsel -i -b
      ;;
  esac
fi
