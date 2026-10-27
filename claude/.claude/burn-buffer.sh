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

# 表示とは独立して利用枠だけを保存し、計算・正規化は読み手に任せる。
(
  umask 077
  cache="$HOME/.cache/conky-usage"
  mkdir -p -m 700 "$cache" || exit 0
  # ccstatusline に kill されると EXIT trap が走らず一時ファイルが残るため掃除する。
  find "$cache" -maxdepth 1 -name '.claude-statusline.*' -mmin +5 -delete
  temporary=$(mktemp "$cache/.claude-statusline.XXXXXX") || exit 0
  trap 'rm -f -- "$temporary"' EXIT
  if printf '%s\n' "$json" | jq -e '
    def valid:
      type == "object" and
      (.used_percentage | type == "number" and . >= 0 and . <= 100) and
      (.resets_at | type == "number" and . >= 0);
    def window:
      if valid then {used_percentage, resets_at} else null end;
    .rate_limits | select(type == "object") |
    {five_hour: (.five_hour | window), seven_day: (.seven_day | window)} |
    select((.five_hour | valid) or (.seven_day | valid)) |
    {schema_version: 2, fetched_at: (now | todateiso8601), rate_limits: .}
  ' > "$temporary"; then
    mv -f -- "$temporary" "$cache/claude.json"
  fi
) 2>/dev/null || :

read -r used resets <<<"$(printf '%s\n' "$json" | jq -r '
  .rate_limits.five_hour |
  if type == "object" and
     (.used_percentage | type == "number" and . >= 0 and . <= 100) and
     (.resets_at | type == "number" and . >= 0 and . == floor)
  then "\(.used_percentage) \(.resets_at)" else "null null" end' 2>/dev/null)"

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
