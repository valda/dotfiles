#!/bin/bash

# 現在のWSとモニター
current_ws=$(hyprctl activeworkspace -j | jq '.id')
current_monitor=$(hyprctl activeworkspace -j | jq -r '.monitor')

# モニター一覧
monitors=($(hyprctl monitors -j | jq -r '.[].name'))

# 次のモニターを探す
for i in "${!monitors[@]}"; do
  if [[ "${monitors[$i]}" == "$current_monitor" ]]; then
    next_index=$(( (i + 1) % ${#monitors[@]} ))
    next_monitor="${monitors[$next_index]}"
    break
  fi
done

# 次のモニターにWSを移動
hyprctl dispatch moveworkspacetomonitor "$current_ws" "$next_monitor"
hyprctl dispatch focusmonitor "$next_monitor"
hyprctl dispatch workspace "$current_ws"
