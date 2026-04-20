#!/usr/bin/env bash
# ~/.claude/burn-buffer.sh
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

# awk で浮動小数点。warmup 判定も awk 内で行い bc を排除
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
