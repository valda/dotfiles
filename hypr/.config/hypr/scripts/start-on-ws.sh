#!/bin/bash
# ~/.config/hypr/scripts/start-on-ws.sh

ws="$1"
shift

# 切り替え（アクティブディスプレイに影響）
hyprctl dispatch workspace "$ws"

# アプリ実行
exec "$@"
