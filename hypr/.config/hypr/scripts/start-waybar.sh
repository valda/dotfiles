# ~/.config/hypr/scripts/start-bars.sh を作成
#!/bin/bash

# 少し待機（Hyprlandが起動するまで）
sleep 5

# 念のため既存プロセスをキル
killall waybar dropbox solaar discord 2>/dev/null

# Waybar起動
waybar &

# トレイアプリ起動
dropbox start &
solaar --window=hide &
discord --start-minimized &

# 他に必要なトレイアプリがあればここに追加
# blueman-applet &
# volumeicon &
