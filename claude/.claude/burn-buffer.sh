#!/usr/bin/env bash
# ~/.claude/burn-buffer.sh
#
# ccstatusline 用のカスタムスクリプト。
# Claude Code の5時間レート制限ウィンドウにおける消費ペースから
# 「リセットまでに枯渇するか／余裕があるか」を計算してステータスラインに表示する。
#
# 【セットアップ】
# ccstatusline の標準設定 UI から custom-command として登録するのが最も簡単:
#
#   npx -y ccstatusline@latest
#   # または
#   bunx -y ccstatusline@latest
#
# UI 上で `Add Item` → `custom-command` を選び、
# Command Path に `~/.claude/burn-buffer.sh` を指定、
# Preserve Colors を有効化すれば良い。
#
# 【設定例】 ~/.config/ccstatusline/settings.json から該当エントリのみ抜粋:
#
#   {
#     "id": "67c58c35-7161-4873-a3dd-adb66e347838",
#     "type": "custom-command",
#     "color": "",
#     "commandPath": "~/.claude/burn-buffer.sh",
#     "preserveColors": true
#   }
#
# preserveColors を true にしないと、本スクリプトが出力する ANSI カラーコード
# (緑/黄/赤の状態色) がステータスラインに反映されない点に注意。
json=$(cat)
read used resets <<<$(echo "$json" | jq -r '
  "\(.rate_limits.five_hour.used_percentage // "null") \(.rate_limits.five_hour.resets_at // "null")"')

# 欠損時のフォールバック
if [[ "$used" == "null" || "$resets" == "null" || -z "$used" ]]; then
  echo "⏳ --"
  exit 0
fi

now=$(date +%s)
start=$(( resets - 18000 ))          # 5h = 18000s
elapsed=$(( now - start ))
remain=$(( resets - now ))
reset_hm=$(date -d "@$resets" +%H:%M)

# awk で浮動小数点。warmup 判定も awk 内で行う
awk -v u="$used" -v e="$elapsed" -v r="$remain" -v rhm="$reset_hm" 'BEGIN {
  # 立ち上がり直後は burn rate が不安定なので除外
  if (e < 120 || u < 3) { printf "⏳ warmup (%.0f%%) →%s", u, rhm; exit }
  burn = u / e                 # %/秒
  wall = (100 - u) / burn      # このペースで100%に達するまでの秒数
  buf  = wall - r              # reset到達までの余裕秒 (正=余裕, 負=先に枯渇)
  sign = buf >= 0 ? "+" : ""
  mins = int(buf / 60)
  # 色: 余裕→緑, 少ない→黄, マイナス→赤
  if      (buf >  1800) printf "\033[32m⏳ %s%dm\033[0m →%s", sign, mins, rhm
  else if (buf >     0) printf "\033[33m⏳ %s%dm\033[0m →%s", sign, mins, rhm
  else                  printf "\033[31m⏳ %s%dm\033[0m →%s", sign, mins, rhm
}'
