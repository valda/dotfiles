#!/usr/bin/env bash
# Codex PR review & CI 並走ポーリングループ
# 使い方: REPO=<owner/repo> PR=<番号> bash scripts/codex-poll.sh
# 出力ステータス: NEW_FINDINGS / CONVERGED / CI_FAILED / TIMEOUT
#
# 反証コメント後の再起動: 既に NEW_FINDINGS を返した review に反証コメントだけ投げて
#   再起動する場合は SEEN_RID=<前回の review id> を渡す。同 RID の findings は
#   「再評価待ち」として pending 扱いになり、新 RID 発行 or 👍 reaction が来るまで
#   ポーリングを継続する。SEEN_RID を渡さないと、対応済み findings を毎回検知して
#   サイクル 1 で即 exit するループから抜けられない。
set -u

: "${REPO:?REPO=<owner/repo> を指定}"
: "${PR:?PR=<PR番号> を指定}"
BOT="${BOT:-chatgpt-codex-connector[bot]}"
MAX_CYCLES="${MAX_CYCLES:-18}"   # 2分 × 18 = 最大36分
INTERVAL="${INTERVAL:-120}"
NUDGE_AFTER="${NUDGE_AFTER:-3}"  # この周回数 pending が続いたら @codex review を 1 回だけ投げる
SEEN_RID="${SEEN_RID:-}"         # 反証済み review id。同 RID の findings は pending 扱い

HEAD=$(gh pr view "$PR" --json headRefOid -q .headRefOid); H10=${HEAD:0:10}

REVIEW_STATE="pending"  # pending / converged / findings
CI_STATE="pending"      # pending / passed / failed
REVIEW_SUMMARY=""
NUDGED=false             # 同じセッション中の @codex review 再投げ防止

for i in $(seq 1 "$MAX_CYCLES"); do
  # 毎周回 HEAD を取り直す（自分が push したらサイクル切れ目で sha が変わる）
  HEAD=$(gh pr view "$PR" --json headRefOid -q .headRefOid); H10=${HEAD:0:10}

  PREV_REVIEW_STATE="$REVIEW_STATE"
  PREV_CI_STATE="$CI_STATE"

  # ─── (A) Review state を更新（pending のときだけ確認） ───
  if [ "$REVIEW_STATE" = "pending" ]; then
    # 本文 👍 reaction
    if gh api "repos/$REPO/issues/$PR/reactions" \
         --jq ".[] | select(.user.login==\"$BOT\" and .content==\"+1\")" 2>/dev/null | grep -q .; then
      REVIEW_STATE="converged"
    else
      # HEAD sha 対象の bot review に inline/body 指摘があるか
      RID=$(gh api "repos/$REPO/pulls/$PR/reviews" --paginate \
        --jq "[.[] | select(.user.login==\"$BOT\" and (.body | contains(\"$H10\")))] | last | .id // empty")
      if [ -n "$RID" ]; then
        if [ -n "$SEEN_RID" ] && [ "$RID" = "$SEEN_RID" ]; then
          # 反証済み review。新しい review or 👍 reaction を待つため pending 維持
          :
        else
          NEW=$(gh api "repos/$REPO/pulls/$PR/comments" --paginate \
            --jq "[.[] | select(.pull_request_review_id==$RID)] | .[].id")
          BODY_HAS_FINDING=$(gh api "repos/$REPO/pulls/$PR/reviews/$RID" \
            --jq '.body | test("P[0-9] Badge")' 2>/dev/null)
          if [ -n "$NEW" ] || [ "$BODY_HAS_FINDING" = "true" ]; then
            REVIEW_STATE="findings"
            REVIEW_SUMMARY="review=$RID inline=[$NEW] body_has_finding=$BODY_HAS_FINDING"
          fi
          # review は来たが指摘なし→ pending のまま 👍 reaction を次周回で待つ
        fi
      fi
    fi
  fi

  # ─── (B) CI state を更新（pending のときだけ確認） ───
  if [ "$CI_STATE" = "pending" ]; then
    CI_JSON=$(gh pr view "$PR" --json statusCheckRollup -q '.statusCheckRollup')
    if echo "$CI_JSON" | jq -e '.[] | select(.conclusion=="FAILURE" or .conclusion=="CANCELLED")' > /dev/null 2>&1; then
      CI_STATE="failed"
    elif echo "$CI_JSON" | jq -e 'length>0 and all(.[]; .conclusion=="SUCCESS" or .conclusion=="SKIPPED" or .conclusion=="NEUTRAL")' > /dev/null 2>&1; then
      CI_STATE="passed"
    fi
  fi

  echo "[$i/$MAX_CYCLES] $(date +%H:%M:%S) review=$REVIEW_STATE ci=$CI_STATE"

  # ─── 状態遷移を視覚化（pending → 確定の境目を見えるようにする） ───
  if [ "$PREV_REVIEW_STATE" != "$REVIEW_STATE" ]; then
    case "$REVIEW_STATE" in
      converged) echo "  → 👍 Codex review 収束。CI 完了を待ちます" ;;
      findings)  echo "  → ⚠ Codex review に指摘あり" ;;
    esac
  fi
  if [ "$PREV_CI_STATE" != "$CI_STATE" ]; then
    case "$CI_STATE" in
      passed) echo "  → ✅ CI passed" ;;
      failed) echo "  → ❌ CI failed" ;;
    esac
  fi

  # ─── (D) Pending nudge: push trigger の自動再レビューは不確実なので、
  #     pending が続いたら 1 度だけ @codex review を投げて bot を起こす ───
  if [ "$REVIEW_STATE" = "pending" ] && [ "$NUDGED" = "false" ] && [ "$i" -ge "$NUDGE_AFTER" ]; then
    # 👍 / 👀 / -1 reaction が既にあれば触らない（収束済み or 処理中 or 否定済み）。
    # 既存 👍 に投げると bot が再処理して 👀 で 👍 を上書きする罠を回避（過去メモ）。
    if ! gh api "repos/$REPO/issues/$PR/reactions" --paginate \
           --jq ".[] | select(.user.login==\"$BOT\" and (.content==\"+1\" or .content==\"eyes\" or .content==\"-1\"))" 2>/dev/null | grep -q .; then
      echo "[$i/$MAX_CYCLES] $(date +%H:%M:%S) NUDGE: posting @codex review (push trigger 不発の可能性)"
      gh pr comment "$PR" --body "@codex review" > /dev/null 2>&1 || true
      NUDGED=true
    fi
  fi

  # ─── (C) 終端判定（優先順位）───
  # NEW_FINDINGS は CI 完了を待たない。次 push で CI 再実行されるため現 HEAD の CI 結果は無価値
  if [ "$REVIEW_STATE" = "findings" ]; then
    echo "NEW_FINDINGS: $REVIEW_SUMMARY"; exit 0
  fi
  # CI fail は review state に関わらず修正必要 (findings なしを前提に CI 失敗だけ修正でよい)
  if [ "$CI_STATE" = "failed" ]; then
    echo "CI_FAILED"; gh pr checks "$PR" | tail -10; exit 2
  fi
  # 両者揃って初めて CONVERGED
  if [ "$REVIEW_STATE" = "converged" ] && [ "$CI_STATE" = "passed" ]; then
    echo "CONVERGED"; exit 0
  fi

  sleep "$INTERVAL"
done
echo "TIMEOUT review=$REVIEW_STATE ci=$CI_STATE"; exit 0
