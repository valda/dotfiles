---
name: codex-pr-review-loop
description: |
  PR 提出後、GitHub の Codex 自動レビュー（chatgpt-codex-connector[bot]）を
  3 分毎にポーリングで待ち、指摘の採用判定 → 修正 or 反証コメント → 再レビュー待ち、
  を収束（bot が PR に 👍 reaction を付ける）まで繰り返すワークフロー。
  トリガー: "PRレビューループ", "codexレビューを待って対応", "PR review loop",
           "レビュー収束まで回して", "babysit PR", "PRの面倒を見て"
---

# codex-pr-review-loop

PR 提出後の Codex 自動レビュー対応を収束まで自動運転するスキル。
`codex-cross-review`（ローカル CLI レビュー）の収束ループ構造を、GitHub 上の
Codex bot レビューに転用したもの。

**前提**: このリポジトリには Codex の GitHub レビュー連携が設定されている
（PR open / draft 解除 / `@codex review` コメントでレビューが走り、
指摘があれば inline comment、無ければ 👍 reaction が付く）。
他リポジトリに自動レビュー設定があるとは限らないため、このスキルは
プロジェクトローカルに置いている。

## 全体フロー

```
PR 提出（または既存 PR 指定）
  └→ [ポーリング] 3 分毎に新規指摘 or 収束サインをチェック（bg ループ）
       ├─ 👍 reaction 検知 → 収束。対応サマリを報告して終了
       ├─ 新規指摘あり → トリアージ（採用判定）
       │    ├─ 採用 → 修正コミット + push + PR に対応コメント → CI 確認 → ポーリング再開
       │    └─ 不採用 → 反証コメントを PR に投稿 → ポーリング再開
       └─ タイムアウト → 状況を報告してユーザーに判断を仰ぐ
```

## 手順

### Codex bot の挙動（判定の前提）

実観測（2026-06-12）で確認した Codex GitHub bot の挙動:

- **新しいコミットを push するか `@codex review` する毎に、その HEAD コミットを対象に
  review（state=COMMENTED）を 1 つ発行する**。review body には「Reviewed commit: `<sha>`」が入る
- **指摘があれば**その review に inline comment（`pulls/comments`、`pull_request_review_id` で紐づく）が付く
- **指摘が無ければ** inline comment ゼロで、👍 reaction が付く（reaction の付き場所は
  PR 本文 issue reaction のことが多いが確実ではない）
- ⚠️ **落とし穴**: `gh api pulls/<PR>/comments` はデフォルト 30 件/ページ。
  必ず `--paginate` を付ける（付けないと新しい指摘を取りこぼして誤って TIMEOUT/収束と判断する）

→ なので判定は **「現在の HEAD sha に対する bot review の inline comment があるか」** と
**「PR 本文に bot の 👍 reaction が付いたか」** の **両方**を見る。

⚠️ **実運用で判明した収束サインの揺れ（2026-06-12）**:
- 指摘が無いとき、Codex は HEAD sha 対象の review を **発行しないことがある**（COMMENTED review
  が出ず、代わりに PR 本文へ 👍 を付けるだけ）。HEAD review の有無だけを見ると、この収束を
  TIMEOUT と誤判定する（実際にこのループの最終収束を一度取りこぼした）
- 👍 は **PR 本文の issue reaction**（`issues/<PR>/reactions`）に付いた。review レベルや
  各 comment ではなかった
→ ゆえに **収束チェック（本文 👍）と新規指摘チェック（HEAD review の inline）を毎ループ併走**させる。

### 1. PR 特定と初期スナップショット

- PR 番号: 引数で指定されなければ `gh pr view --json number -q .number`
- `{owner}/{repo}` は `gh repo view --json nameWithOwner -q .nameWithOwner`
- 現在の HEAD: `gh pr view <PR> --json headRefOid -q .headRefOid`
  ⚠️ **HEAD sha は必ずこのコマンドで変数取得し、手打ちしない**（手打ちのタイプミスで
  別 sha を照合し、来ているレビューを取りこぼした実例あり。短縮は `${HEAD:0:10}`）

### 2. ポーリング（3 分毎、バックグラウンド）

foreground の `sleep` はブロックされるため、**判定込みのポーリングループを 1 本の
バックグラウンド Bash として起動**し（`run_in_background: true`、timeout 2100000 程度）、
完了通知で Claude が再開する。**収束（本文 👍）と新規指摘（HEAD review の inline）を
毎ループ併走**で見る。HEAD sha はスクリプト内で取得し手打ちしない:

```bash
REPO="<owner/repo>"
PR=<PR番号>
BOT="chatgpt-codex-connector[bot]"
HEAD=$(gh pr view "$PR" --json headRefOid -q .headRefOid); H10=${HEAD:0:10}
for i in $(seq 1 12); do  # 3分 × 12 = 最大36分
  # (A) 収束チェック: PR 本文に bot の 👍。指摘ゼロのとき review を出さず
  #     本文 reaction だけ付けることがあるので、これを最優先で見る
  if gh api "repos/$REPO/issues/$PR/reactions" \
       --jq ".[] | select(.user.login==\"$BOT\" and .content==\"+1\")" 2>/dev/null | grep -q .; then
    echo "CONVERGED: PR本文に👍"; exit 0
  fi
  # (B) 新規指摘チェック: HEAD コミットを対象にした bot review の inline comment
  RID=$(gh api "repos/$REPO/pulls/$PR/reviews" --paginate \
    --jq "[.[] | select(.user.login==\"$BOT\" and (.body | contains(\"$H10\")))] | last | .id // empty")
  if [ -n "$RID" ]; then
    NEW=$(gh api "repos/$REPO/pulls/$PR/comments" --paginate \
      --jq "[.[] | select(.pull_request_review_id==$RID)] | .[].id")
    if [ -n "$NEW" ]; then echo "NEW_FINDINGS: $NEW"; exit 0; fi
    # HEAD review はあるが inline ゼロ＝指摘なし。本文 👍 も併せて確認できれば収束
    echo "CONVERGED: HEAD $H10 のレビューに指摘なし（review $RID）"; exit 0
  fi
  sleep 180
done
echo "TIMEOUT"; exit 0
```

- `NEW_FINDINGS: <id...>` → 手順 3 へ（その id 群を対応する）
- `CONVERGED` → 手順 5 へ
- `TIMEOUT` → HEAD review も本文 👍 も無い。`@codex review` で明示依頼してポーリング再起動。
  **それでも来ないとき、TIMEOUT を収束と誤認しない**: 必ず手動で本文 reaction
  （`issues/<PR>/reactions`）を確認する（review 不発で 👍 だけ来ているケースがある）。
  本当に何も無ければユーザーに報告して判断を仰ぐ

**重要**:
- 1 サイクルで指摘を直して push する毎に HEAD sha が変わる。ポーリングは毎回スクリプト先頭で
  HEAD を取り直す（上記のように `gh pr view` で取得）。前 sha のレビューを収束と誤認しない
- push トリガーの自動レビューは不確実。push 後 CI green を確認したら `@codex review` を
  明示的に投げてからポーリングするのが確実

### 3. トリアージ（採用判定）

新規指摘の本文を取得し、1 件ずつ判定する:

```bash
gh api repos/{owner}/{repo}/pulls/comments/<id> --jq '{path, body}'
```

**採用する**（修正コミットで対応）:
- 正しさ・セキュリティ・データ損失・レース条件・仕様矛盾など実害のある指摘
- 再現シナリオが具体的で、コードを読んで事実確認できたもの
- ※ 必ず自分でコードを読んで指摘の妥当性を検証する。bot の指摘を鵜呑みにしない。
  検証の結果「指摘の射程より問題が広い／同質の問題が他にもある」と分かったら、
  対症療法でなく根本側を直す（例: trim 専用修正でなく汎用機構化）

**不採用**（反証コメントで対応）:
- 誤検知（コードの事実と異なる）: 根拠（file:line と実際の挙動）を添えて PR コメントで反証
- スコープ外（別 Issue が妥当）: その旨をコメントし、必要なら Issue を起票してリンク
- スタイル・過剰最適化の提案で観測根拠が無いもの

**エスカレート**（ユーザーに判断を仰ぐ）:
- スコープを覆す提案、新規ファイル・抽象化・設定キーの追加を要する対応
- 採用判定に確信が持てないもの
- 同一指摘が 2 サイクル続く（堂々巡り）

### 4. 対応

**採用時**:
1. 修正を実装（薄い修正は直接、大きい修正は `codex-yolo-implement` に委譲してよい）
2. pre-commit checklist（関連範囲の lint / spec。CLAUDE.md 参照）を通す
3. **可能な限り回帰テストを足す**（指摘されたシナリオを再現するテスト）
4. Conventional Commits（日本語）でコミットして push
5. PR に対応コメントを投稿: コミット hash、何をどう直したか、検証結果（spec 件数等）を明記

**不採用時**:
- PR コメントに反証・理由を投稿（必要なら bot の該当コメントに 👎 reaction）

**push 後**: `gh pr checks <PR> --watch` も同じバックグラウンド方式で確認。
CI fail なら原因を特定して修正してから次サイクルへ（CI 失敗の扱いは下記の注意も参照）。
その後 手順 2 のポーリングを再起動する。

### 5. 収束時の報告

対応サマリを報告して終了:
- 採用 n 件（コミット一覧と要旨）/ 不採用 n 件（理由）/ エスカレート n 件
- CI 最終状態

## 注意事項

- **ループ上限**: 10 サイクルで打ち切ってユーザーに報告（暴走防止）。
  ただし「同じ系統の指摘が自分の修正の穴を生んで連鎖する」場合は、上限前でも
  ユーザーに状況を正直に共有し、設計の一段見直し / 現状マージ＋残りを別 Issue 化 /
  続行 のいずれかを相談する（実例: 非同期ジョブ完了が POST 応答より先に来る
  「高速完了レース」が pending→files→flag と層を変えて数サイクル続いた）
- **CI 失敗が CI 環境起因に見える場合**（ローカル green / CI のみ fail）は、
  node バージョン・CPU 数（ubuntu-latest は 2 vCPU）に加え、**lock 通りの依存解決**を
  docker で再現してから直す。`yarn install --frozen-lockfile --force` で lock 版に
  揃える（ローカル node_modules だけ新しい版に上がっていて CI と乖離する罠がある。
  実例: yarn.lock の svelte が古く、await 後の $state 更新が描画に反映されないバグを
  踏んだ。バージョン bump で根治）。
  例: `docker run --rm --cpus=2 -v "$PWD":/app -e HOME=/work node:20 sh -c "git config --global --add safe.directory '*' && git clone -q /src /work/repo && cd /work/repo && yarn install --frozen-lockfile --cache-folder /work/.yc && yarn test"`。
  タイミング依存に見えても確定的バグのことがあるので、まず lock 版で再現を取る
- bot の指摘コメントには「Useful? React with 👍 / 👎」が付く。誤検知には 👎 を
  付けるとフィードバックになる:
  `gh api -X POST repos/{owner}/{repo}/pulls/comments/<id>/reactions -f content=-1`
- 1 つの指摘対応で push すると再レビューが走り新しい指摘が来ることがある。
  複数指摘が同時に来ている場合はまとめて対応してから push するとサイクルが少なく済む
- **自分の修正でバグを入れた指摘は素直に直す**（堂々巡りではない）。一方、同じ箇所で
  「直す→別の穴」を 2 回繰り返したら設計を疑い、対症療法でなく構造を見直す
- ユーザーから新しい指示・割り込みがあればループより優先する

## 関連スキル

- **codex-yolo-implement**: 採用指摘の修正が大きいときの実装委譲先
- **codex-cross-review**: GitHub 連携が無いリポジトリ・コミット前のローカルレビューはこちら
- **commit**: pre-commit checklist 込みのコミット
